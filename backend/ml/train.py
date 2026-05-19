import json
import os

import joblib
import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import (
    ExtraTreesClassifier,
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
)
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputRegressor

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "Traffic.csv")
MODELS_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "models"))
os.makedirs(MODELS_DIR, exist_ok=True)

DAY_MAP = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}

FEATURE_COLS = [
    "TimeNum",
    "DayNum",
    "Is_Weekend",
    "Is_Peak",
    "Rain",
    "Clouds",
    "Total_Lag1",
    "Total_Lag2",
    "Total_Lag3",
    "Total_Lag4",
    "Total_Lag96",
    "Total_RollMean4",
    "Total_RollStd4",
    "SinTime",
    "CosTime",
    "SinDay",
    "CosDay",
    "PeakLagInteraction",
    "RainLagInteraction",
    "CloudPeakInteraction",
]

CLASS_ORDER = ["Low", "Normal", "High", "Heavy"]
TRAIN_PIPELINE_VERSION = "v4.0-temporal-lags"


def build_total_thresholds(y_labels, totals):
    """Learn class boundaries from train-set total volume distributions."""
    frame = pd.DataFrame({"label": y_labels.values, "total": totals.values})
    medians = frame.groupby("label")["total"].median().to_dict()
    class_medians = []
    for label in CLASS_ORDER:
        if label in medians:
            class_medians.append((label, float(medians[label])))
    class_medians = sorted(class_medians, key=lambda x: x[1])

    if len(class_medians) < 2:

        return {
            "labels": ["Low", "Normal", "High", "Heavy"],
            "boundaries": [60.0, 120.0, 180.0],
        }

    labels = [label for label, _ in class_medians]
    med = [val for _, val in class_medians]
    boundaries = [(med[i] + med[i + 1]) / 2.0 for i in range(len(med) - 1)]
    return {"labels": labels, "boundaries": boundaries}


def map_total_to_label(total_value, threshold_config):
    labels = threshold_config["labels"]
    boundaries = threshold_config["boundaries"]
    for idx, boundary in enumerate(boundaries):
        if total_value < boundary:
            return labels[idx]
    return labels[-1]


def build_prev_traffic_thresholds(y_labels, prev_traffic):
    """Learn class boundaries from previous-interval traffic distributions."""
    frame = pd.DataFrame({"label": y_labels.values, "prev": prev_traffic.values})
    medians = frame.groupby("label")["prev"].median().to_dict()
    class_medians = []
    for label in CLASS_ORDER:
        if label in medians:
            class_medians.append((label, float(medians[label])))
    class_medians = sorted(class_medians, key=lambda x: x[1])

    if len(class_medians) < 2:
        return {
            "labels": ["Low", "Normal", "High", "Heavy"],
            "boundaries": [60.0, 120.0, 180.0],
        }

    labels = [label for label, _ in class_medians]
    med = [val for _, val in class_medians]
    boundaries = [(med[i] + med[i + 1]) / 2.0 for i in range(len(med) - 1)]
    return {"labels": labels, "boundaries": boundaries}


def map_prev_to_label(prev_traffic_value, threshold_config):
    labels = threshold_config["labels"]
    boundaries = threshold_config["boundaries"]
    for idx, boundary in enumerate(boundaries):
        if prev_traffic_value < boundary:
            return labels[idx]
    return labels[-1]


def fetch_dubai_weather():
    """Fetch weather; fallback to zeroed weather if API unavailable."""
    print("Fetching historical weather data...")
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": 25.2048,
        "longitude": 55.2708,
        "start_date": "2023-12-01",
        "end_date": "2023-12-31",
        "hourly": ["precipitation", "cloud_cover"],
        "timezone": "auto",
    }
    try:
        response = requests.get(url, params=params, timeout=20)
        response.raise_for_status()
        weather_json = response.json()
        weather_df = pd.DataFrame(
            {
                "Datetime": pd.to_datetime(weather_json["hourly"]["time"]),
                "Rain": weather_json["hourly"]["precipitation"],
                "Clouds": weather_json["hourly"]["cloud_cover"],
            }
        )
        weather_df["JoinKey"] = weather_df["Datetime"].dt.strftime("%Y-%m-%d %H:00:00")
        return weather_df[["JoinKey", "Rain", "Clouds"]]
    except Exception as exc:
        print(f"Weather fetch failed ({exc}). Falling back to zero-weather.")

        dt_range = pd.date_range("2023-12-01 00:00:00", "2023-12-31 23:00:00", freq="H")
        return pd.DataFrame(
            {
                "JoinKey": dt_range.strftime("%Y-%m-%d %H:00:00"),
                "Rain": np.zeros(len(dt_range)),
                "Clouds": np.zeros(len(dt_range)),
            }
        )


def engineer_features(df):
    """Engineer robust time-aware features from base columns."""
    df = df.copy()
    df["Minute"] = df["Datetime"].dt.minute
    df["TimeNum"] = df["Datetime"].dt.hour + (df["Minute"] / 60.0)
    df["DayNum"] = df["Day of the week"].map(DAY_MAP).fillna(0).astype(int)
    df["Is_Weekend"] = df["DayNum"].isin([5, 6]).astype(int)
    df["Is_Peak"] = (
        df["Datetime"].dt.hour.isin([7, 8, 9, 17, 18, 19, 20]).astype(int)
    )

    df["Rain"] = df["Rain"].fillna(0.0).astype(float)
    df["Clouds"] = df["Clouds"].fillna(0.0).astype(float)
    df["Total_Lag1"] = df["Total"].shift(1)
    df["Total_Lag2"] = df["Total"].shift(2)
    df["Total_Lag3"] = df["Total"].shift(3)
    df["Total_Lag4"] = df["Total"].shift(4)

    df["Total_Lag96"] = df["Total"].shift(96)
    df["Total_RollMean4"] = df["Total"].shift(1).rolling(window=4).mean()
    df["Total_RollStd4"] = df["Total"].shift(1).rolling(window=4).std()


    df["SinTime"] = np.sin(2 * np.pi * (df["TimeNum"] / 24.0))
    df["CosTime"] = np.cos(2 * np.pi * (df["TimeNum"] / 24.0))
    df["SinDay"] = np.sin(2 * np.pi * (df["DayNum"] / 7.0))
    df["CosDay"] = np.cos(2 * np.pi * (df["DayNum"] / 7.0))


    df["PeakLagInteraction"] = df["Is_Peak"] * df["Total_RollMean4"]
    df["RainLagInteraction"] = df["Rain"] * df["Total_RollMean4"]
    df["CloudPeakInteraction"] = df["Clouds"] * df["Is_Peak"]

    return df.dropna(
        subset=[
            "CarCount",
            "BikeCount",
            "BusCount",
            "TruckCount",
            "Traffic Situation",
            "Total_Lag1",
            "Total_Lag2",
            "Total_Lag3",
            "Total_Lag4",
            "Total_Lag96",
            "Total_RollMean4",
            "Total_RollStd4",
        ]
    )


def load_and_preprocess_data():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Traffic dataset not found at: {DATA_PATH}")

    print("Processing traffic dataset with advanced temporal features...")
    traffic_df = pd.read_csv(DATA_PATH)
    traffic_df["Datetime"] = pd.to_datetime(
        "2023-12-" + traffic_df["Date"].astype(str) + " " + traffic_df["Time"].astype(str),
        format="%Y-%m-%d %I:%M:%S %p",
        errors="coerce",
    )
    traffic_df = traffic_df.dropna(subset=["Datetime"])
    traffic_df = traffic_df.sort_values("Datetime").reset_index(drop=True)

    traffic_df["JoinKey"] = traffic_df["Datetime"].dt.strftime("%Y-%m-%d %H:00:00")
    merged_df = pd.merge(traffic_df, fetch_dubai_weather(), on="JoinKey", how="left")


    merged_df["Traffic Situation"] = (
        merged_df["Traffic Situation"].astype(str).str.strip().str.lower().str.title()
    )
    return engineer_features(merged_df)


def train_models():
    df = load_and_preprocess_data()
    X = df[FEATURE_COLS]
    y_counts = df[["CarCount", "BikeCount", "BusCount", "TruckCount"]]
    y_situation = df["Traffic Situation"]

    X_train, X_test, y_c_train, y_c_test, y_s_train, y_s_test = train_test_split(
        X, y_counts, y_situation, test_size=0.2, random_state=42, stratify=y_situation
    )


    regressor = MultiOutputRegressor(
        HistGradientBoostingRegressor(
            max_iter=300,
            learning_rate=0.05,
            max_leaf_nodes=63,
            random_state=42,
        )
    )
    regressor.fit(X_train, y_c_train)


    classifier_candidates = {
        "RandomForest": RandomForestClassifier(
            n_estimators=450,
            max_depth=20,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            random_state=42,
            n_jobs=-1,
        ),
        "ExtraTrees": ExtraTreesClassifier(
            n_estimators=500,
            max_depth=22,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        ),
        "HistGradientBoosting": HistGradientBoostingClassifier(
            max_iter=450,
            learning_rate=0.05,
            max_leaf_nodes=63,
            random_state=42,
        ),
    }

    best_name = None
    best_model = None
    best_macro_f1 = -1.0
    best_pred = None

    candidate_scores = {}
    for model_name, model in classifier_candidates.items():
        model.fit(X_train, y_s_train)
        pred = model.predict(X_test)
        macro_f1 = f1_score(y_s_test, pred, average="macro")
        candidate_scores[model_name] = round(float(macro_f1) * 100, 2)
        if macro_f1 > best_macro_f1:
            best_macro_f1 = macro_f1
            best_name = model_name
            best_model = model
            best_pred = pred


    ensemble_pred = None
    if all(hasattr(model, "predict_proba") for model in classifier_candidates.values()):
        labels_union = sorted(y_s_train.unique().tolist())
        label_to_index = {label: idx for idx, label in enumerate(labels_union)}
        proba_sum = np.zeros((len(X_test), len(labels_union)))
        for model in classifier_candidates.values():
            model_proba = model.predict_proba(X_test)
            model_classes = list(model.classes_)
            aligned = np.zeros((len(X_test), len(labels_union)))
            for class_idx, class_name in enumerate(model_classes):
                aligned[:, label_to_index[class_name]] = model_proba[:, class_idx]
            proba_sum += aligned
        avg_proba = proba_sum / float(len(classifier_candidates))
        ensemble_pred = np.array([labels_union[idx] for idx in np.argmax(avg_proba, axis=1)])
        ensemble_macro_f1 = f1_score(y_s_test, ensemble_pred, average="macro")
        candidate_scores["SoftVotingEnsemble"] = round(float(ensemble_macro_f1) * 100, 2)
        if ensemble_macro_f1 > best_macro_f1:
            best_macro_f1 = ensemble_macro_f1
            best_name = "SoftVotingEnsemble"
            best_model = None
            best_pred = ensemble_pred


    threshold_config = build_total_thresholds(y_s_train, y_c_train.sum(axis=1))
    reg_counts_test = regressor.predict(X_test)
    total_pred_test = reg_counts_test.sum(axis=1)
    threshold_pred = np.array(
        [map_total_to_label(total_val, threshold_config) for total_val in total_pred_test]
    )
    threshold_macro_f1 = f1_score(y_s_test, threshold_pred, average="macro")
    candidate_scores["TotalThresholdRule"] = round(float(threshold_macro_f1) * 100, 2)
    if threshold_macro_f1 > best_macro_f1:
        best_macro_f1 = threshold_macro_f1
        best_name = "TotalThresholdRule"
        best_model = None
        best_pred = threshold_pred


    prev_threshold_config = build_prev_traffic_thresholds(y_s_train, X_train["Total_Lag1"])
    prev_threshold_pred = np.array(
        [map_prev_to_label(v, prev_threshold_config) for v in X_test["Total_Lag1"].values]
    )
    prev_threshold_macro_f1 = f1_score(y_s_test, prev_threshold_pred, average="macro")
    candidate_scores["PrevTrafficThresholdRule"] = round(float(prev_threshold_macro_f1) * 100, 2)
    if prev_threshold_macro_f1 > best_macro_f1:
        best_macro_f1 = prev_threshold_macro_f1
        best_name = "PrevTrafficThresholdRule"
        best_model = None
        best_pred = prev_threshold_pred

    accuracy = accuracy_score(y_s_test, best_pred)
    weighted_f1 = f1_score(y_s_test, best_pred, average="weighted")
    report = classification_report(y_s_test, best_pred, output_dict=True, zero_division=0)
    labels_sorted = sorted(y_s_test.unique().tolist())
    cm = confusion_matrix(y_s_test, best_pred, labels=labels_sorted).tolist()


    if best_model is not None and hasattr(best_model, "feature_importances_"):
        importances = pd.Series(best_model.feature_importances_, index=FEATURE_COLS)
        grouped_importance = {
            "Time": round(float(importances[["TimeNum", "SinTime", "CosTime"]].sum() * 100), 2),
            "Day/Flags": round(
                float(importances[["DayNum", "Is_Weekend", "Is_Peak", "SinDay", "CosDay"]].sum() * 100),
                2,
            ),
            "Weather": round(float(importances[["Rain", "Clouds", "CloudPeakInteraction"]].sum() * 100), 2),
            "Prior Traffic (Lag)": round(
                float(
                    importances[
                        [
                            "Total_Lag1",
                            "Total_Lag2",
                            "Total_Lag3",
                            "Total_Lag4",
                            "Total_Lag96",
                            "Total_RollMean4",
                            "Total_RollStd4",
                            "PeakLagInteraction",
                            "RainLagInteraction",
                        ]
                    ].sum()
                    * 100
                ),
                2,
            ),
        }
    else:
        grouped_importance = {
            "Time": 0.0,
            "Day/Flags": 0.0,
            "Weather": 0.0,
            "Prior Traffic (Lag)": 0.0,
        }

    joblib.dump(regressor, os.path.join(MODELS_DIR, "regressor.pkl"))
    if best_model is not None:
        joblib.dump(best_model, os.path.join(MODELS_DIR, "classifier.pkl"))

    for model_name, model in classifier_candidates.items():
        joblib.dump(model, os.path.join(MODELS_DIR, f"classifier_{model_name}.pkl"))

    with open(os.path.join(MODELS_DIR, "feature_columns.json"), "w", encoding="utf-8") as f:
        json.dump(FEATURE_COLS, f, indent=2)

    with open(os.path.join(MODELS_DIR, "classifier_config.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "best_classifier": best_name,
                "threshold_config": threshold_config,
                "prev_threshold_config": prev_threshold_config,
            },
            f,
            indent=2,
        )

    metrics = {
        "accuracy": round(accuracy * 100, 2),
        "macro_f1": round(best_macro_f1 * 100, 2),
        "weighted_f1": round(weighted_f1 * 100, 2),
        "best_classifier": best_name,
        "pipeline_version": TRAIN_PIPELINE_VERSION,
        "candidate_macro_f1_scores": candidate_scores,
        "importances": grouped_importance,
        "labels": labels_sorted,
        "confusion_matrix": cm,
        "classification_report": report,
    }
    with open(os.path.join(MODELS_DIR, "metrics.json"), "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"PIPELINE_VERSION={TRAIN_PIPELINE_VERSION}")
    print(f"CANDIDATE_MACRO_F1={json.dumps(candidate_scores)}")
    print(
        f"Models trained. Best classifier={best_name}, "
        f"accuracy={metrics['accuracy']}%, macro_f1={metrics['macro_f1']}%"
    )


if __name__ == "__main__":
    train_models()