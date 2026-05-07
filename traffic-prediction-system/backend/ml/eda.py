import os
import json
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "Traffic.csv")
PUBLIC_DIR = os.path.join(BASE_DIR, "..", "public")
PLOTS_DIR = os.path.join(PUBLIC_DIR, "plots")

os.makedirs(PLOTS_DIR, exist_ok=True)

def run_eda():
    df = pd.read_csv(DATA_PATH)
    
    # 1. Hourly Traffic Volume
    plt.figure(figsize=(10, 6))
    sns.barplot(data=df, x='Time', y='Total', estimator='mean', errorbar=None, color='#00d2ff')
    plt.title('Average Hourly Traffic Volume', color='white')
    plt.xlabel('Time of Day', color='white')
    plt.ylabel('Average Total Traffic', color='white')
    plt.xticks(rotation=45, color='white')
    plt.yticks(color='white')
    plt.gca().set_facecolor('#1a1a2e')
    plt.gcf().patch.set_facecolor('#1a1a2e')
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, 'hourly.png'), facecolor='#1a1a2e', transparent=True)
    plt.close()
    
    # 2. Daily Traffic Volume
    plt.figure(figsize=(10, 6))
    sns.barplot(data=df, x='Day of the week', y='Total', estimator='mean', errorbar=None, color='#3a7bd5')
    plt.title('Average Daily Traffic Volume', color='white')
    plt.xlabel('Day of the Week', color='white')
    plt.ylabel('Average Total Traffic', color='white')
    plt.xticks(color='white')
    plt.yticks(color='white')
    plt.gca().set_facecolor('#1a1a2e')
    plt.gcf().patch.set_facecolor('#1a1a2e')
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, 'daily.png'), facecolor='#1a1a2e', transparent=True)
    plt.close()

    # 3. Traffic Situation Distribution
    plt.figure(figsize=(8, 6))
    situation_counts = df['Traffic Situation'].value_counts()
    plt.pie(situation_counts, labels=situation_counts.index, autopct='%1.1f%%', colors=['#ff9999','#66b3ff','#99ff99','#ffcc99'], textprops={'color':"w"})
    plt.title('Traffic Situation Distribution', color='white')
    plt.gca().set_facecolor('#1a1a2e')
    plt.gcf().patch.set_facecolor('#1a1a2e')
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, 'situation.png'), facecolor='#1a1a2e', transparent=True)
    plt.close()
    
    # Statistics
    stats = {
        "total_records": len(df),
        "peak_hour": df.groupby('Time')['Total'].mean().idxmax(),
        "busiest_day": df.groupby('Day of the week')['Total'].mean().idxmax(),
        "avg_total_traffic": round(df['Total'].mean(), 2),
        "most_common_situation": df['Traffic Situation'].mode()[0]
    }
    
    with open(os.path.join(PLOTS_DIR, 'stats.json'), 'w') as f:
        json.dump(stats, f)

if __name__ == "__main__":
    run_eda()
    print("EDA completed successfully.")
