import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import json

df = pd.read_csv('backend/ml/data/Traffic.csv')
df["Datetime"] = pd.to_datetime("2023-12-" + df["Date"].astype(str) + " " + df["Time"].astype(str), format="%Y-%m-%d %I:%M:%S %p", errors="coerce")
df = df.dropna(subset=["Datetime"]).sort_values("Datetime").reset_index(drop=True)

df["Total_Lag1"] = df["Total"].shift(1)
df = df.dropna(subset=["Total_Lag1"])

X = df[["Time", "Date", "Day of the week", "Total_Lag1"]].copy()
X["TimeNum"] = df["Datetime"].dt.hour + df["Datetime"].dt.minute / 60.0
X["DayNum"] = df["Datetime"].dt.dayofweek
X = X[["TimeNum", "DayNum", "Total_Lag1"]]
y = df["Traffic Situation"]

# Temporal split
split_index = int(len(df) * 0.8)
X_train_temp, X_test_temp = X.iloc[:split_index], X.iloc[split_index:]
y_train_temp, y_test_temp = y.iloc[:split_index], y.iloc[split_index:]

clf1 = RandomForestClassifier(random_state=42)
clf1.fit(X_train_temp, y_train_temp)
print("Temporal split accuracy:", accuracy_score(y_test_temp, clf1.predict(X_test_temp)))

# Random split
X_train_rand, X_test_rand, y_train_rand, y_test_rand = train_test_split(X, y, test_size=0.2, random_state=42)
clf2 = RandomForestClassifier(random_state=42)
clf2.fit(X_train_rand, y_train_rand)
print("Random split accuracy:", accuracy_score(y_test_rand, clf2.predict(X_test_rand)))
