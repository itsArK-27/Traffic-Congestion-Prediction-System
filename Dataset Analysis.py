import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

data = pd.read_csv("D:\Documents\College Content\VS Code\AI Essentials\self\Traffic Congestion Prediction System\Traffic.csv")
df = pd.DataFrame(data)

print(df)
print(df.isna().sum())

plt.figsize(8,5)
plt.show()