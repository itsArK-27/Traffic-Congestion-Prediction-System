import sys
import json
import os
import joblib
import warnings
import numpy as np

warnings.filterwarnings("ignore")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "models"))


def build_feature_row(time, day, rain, clouds, prev_traffic):
    """Build feature vector compatible with training pipeline."""
    is_weekend = 1 if day in [5, 6] else 0
    is_peak = 1 if int(time) in [7, 8, 9, 17, 18, 19, 20] else 0


    lag1 = prev_traffic
    lag2 = prev_traffic
    lag3 = prev_traffic
    lag4 = prev_traffic
    lag96 = prev_traffic
    roll_mean4 = (lag1 + lag2 + lag3 + lag4) / 4.0
    roll_std4 = float(np.std([lag1, lag2, lag3, lag4]))

    sin_time = np.sin(2 * np.pi * (time / 24.0))
    cos_time = np.cos(2 * np.pi * (time / 24.0))
    sin_day = np.sin(2 * np.pi * (day / 7.0))
    cos_day = np.cos(2 * np.pi * (day / 7.0))

    peak_lag_interaction = is_peak * roll_mean4
    rain_lag_interaction = rain * roll_mean4
    cloud_peak_interaction = clouds * is_peak

    return [
        time,
        day,
        is_weekend,
        is_peak,
        rain,
        clouds,
        lag1,
        lag2,
        lag3,
        lag4,
        lag96,
        roll_mean4,
        roll_std4,
        sin_time,
        cos_time,
        sin_day,
        cos_day,
        peak_lag_interaction,
        rain_lag_interaction,
        cloud_peak_interaction,
    ]


def map_total_to_label(total_value, threshold_config):
    labels = threshold_config["labels"]
    boundaries = threshold_config["boundaries"]
    for idx, boundary in enumerate(boundaries):
        if total_value < boundary:
            return labels[idx]
    return labels[-1]


def map_prev_to_label(prev_traffic_value, threshold_config):
    labels = threshold_config["labels"]
    boundaries = threshold_config["boundaries"]
    for idx, boundary in enumerate(boundaries):
        if prev_traffic_value < boundary:
            return labels[idx]
    return labels[-1]


def predict():
    try:

        time = float(sys.argv[1])
        day = float(sys.argv[2])
        rain = float(sys.argv[3])
        clouds = float(sys.argv[4])
        prev_traffic = float(sys.argv[5])


        features = np.array(
            [build_feature_row(time, day, rain, clouds, prev_traffic)], dtype=float
        )


        regressor = joblib.load(os.path.join(MODELS_DIR, "regressor.pkl"))
        classifier_config_path = os.path.join(MODELS_DIR, "classifier_config.json")
        classifier_config = {"best_classifier": "RandomForest", "threshold_config": None}
        if os.path.exists(classifier_config_path):
            with open(classifier_config_path, "r", encoding="utf-8") as f:
                classifier_config = json.load(f)

        classifier = None
        if classifier_config.get("best_classifier") not in [
            "TotalThresholdRule",
            "PrevTrafficThresholdRule",
            "SoftVotingEnsemble",
        ]:
            classifier = joblib.load(os.path.join(MODELS_DIR, "classifier.pkl"))

        with open(os.path.join(MODELS_DIR, "metrics.json"), "r", encoding="utf-8") as f:
            metrics = json.load(f)


        counts_pred = regressor.predict(features)[0]
        if classifier_config.get("best_classifier") == "SoftVotingEnsemble":
            model_paths = [
                os.path.join(MODELS_DIR, "classifier_RandomForest.pkl"),
                os.path.join(MODELS_DIR, "classifier_ExtraTrees.pkl"),
                os.path.join(MODELS_DIR, "classifier_HistGradientBoosting.pkl"),
            ]
            models = [joblib.load(path) for path in model_paths]
            labels_union = sorted(models[0].classes_.tolist())
            label_to_index = {label: idx for idx, label in enumerate(labels_union)}
            proba_sum = np.zeros((1, len(labels_union)))
            for model in models:
                model_proba = model.predict_proba(features)
                model_classes = list(model.classes_)
                aligned = np.zeros((1, len(labels_union)))
                for class_idx, class_name in enumerate(model_classes):
                    aligned[:, label_to_index[class_name]] = model_proba[:, class_idx]
                proba_sum += aligned
            avg_proba = proba_sum / float(len(models))
            situation_pred = labels_union[int(np.argmax(avg_proba, axis=1)[0])]
        elif classifier is not None:
            situation_pred = classifier.predict(features)[0]
        elif classifier_config.get("best_classifier") == "PrevTrafficThresholdRule":
            situation_pred = map_prev_to_label(
                prev_traffic, classifier_config.get("prev_threshold_config")
            )
        else:
            total_pred = float(np.sum(counts_pred))
            situation_pred = map_total_to_label(
                total_pred, classifier_config.get("threshold_config")
            )


        result = {
            "CarCount": int(max(0, round(counts_pred[0]))),
            "BikeCount": int(max(0, round(counts_pred[1]))),
            "BusCount": int(max(0, round(counts_pred[2]))),
            "TruckCount": int(max(0, round(counts_pred[3]))),
            "TrafficSituation": situation_pred,
            "Metrics": metrics,
        }

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    predict()