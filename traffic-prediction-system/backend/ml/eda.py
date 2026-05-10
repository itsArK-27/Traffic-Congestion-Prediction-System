import os
import re
import json
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "Traffic.csv")
PUBLIC_DIR = os.path.join(BASE_DIR, "..", "public")
PLOTS_DIR  = os.path.join(PUBLIC_DIR, "plots")

os.makedirs(PLOTS_DIR, exist_ok=True)

# ── Shared style ────────────────────────────────────────────────────────────
BG      = '#0d0b1a'
PANEL   = '#14112a'
CYAN    = '#00f3ff'
PURPLE  = '#bf00ff'
MAGENTA = '#ff00d4'
GREEN   = '#00ff88'
ORANGE  = '#ff9500'
RED     = '#ff2d55'
MUTED   = '#6c7a99'
WHITE   = '#e8eaf6'
PALETTE = [CYAN, PURPLE, GREEN, ORANGE, RED, MAGENTA, '#ffcc00', '#00bfff']

def _style_ax(ax, title='', xlabel='', ylabel=''):
    ax.set_facecolor(PANEL)
    ax.set_title(title,  color=WHITE,  fontsize=13, fontweight='bold', pad=14)
    ax.set_xlabel(xlabel, color=MUTED, fontsize=10, labelpad=8)
    ax.set_ylabel(ylabel, color=MUTED, fontsize=10, labelpad=8)
    ax.tick_params(colors=MUTED, labelsize=8)
    for spine in ax.spines.values():
        spine.set_edgecolor((1, 1, 1, 0.06))
    ax.grid(axis='y', color=(1, 1, 1, 0.05), linestyle='--', linewidth=0.6)

def _save(name):
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, name), facecolor=BG, bbox_inches='tight')
    plt.close()


def run_eda():
    df = pd.read_csv(DATA_PATH)

    # ── Parse hour from "12:00:00 AM" strings ───────────────────────────────
    def _parse_hour(t):
        try:
            t = str(t).strip()
            match = re.match(r'(\d+):(\d+):\d+\s*(AM|PM)', t, re.IGNORECASE)
            if not match:
                return None
            h, m, period = int(match.group(1)), int(match.group(2)), match.group(3).upper()
            if period == 'AM':
                return 0 if h == 12 else h
            else:
                return 12 if h == 12 else h + 12
        except Exception:
            return None

    df['Hour'] = df['Time'].apply(_parse_hour)
    df = df.dropna(subset=['Hour'])
    df['Hour'] = df['Hour'].astype(int)

    VEHICLE_COLS = ['CarCount', 'BikeCount', 'BusCount', 'TruckCount']

    # ════════════════════════════════════════════════════════════════════════
    # 1. Hourly Traffic Volume (bar — one bar per hour 0-23)
    # ════════════════════════════════════════════════════════════════════════
    hourly_mean = df.groupby('Hour')['Total'].mean().reindex(range(24), fill_value=0)

    fig, ax = plt.subplots(figsize=(12, 5), facecolor=BG)
    bars = ax.bar(hourly_mean.index, hourly_mean.values,
                  color=CYAN, alpha=0.75, width=0.7,
                  edgecolor=(0, 0.95, 1.0, 0.3), linewidth=0.6)
    # Highlight peak bar
    peak_h = int(hourly_mean.idxmax())
    bars[peak_h].set_color(ORANGE)
    bars[peak_h].set_alpha(1.0)

    ax.set_xticks(range(24))
    ax.set_xticklabels([f'{h:02d}:00' for h in range(24)], rotation=45, ha='right', fontsize=7.5)
    _style_ax(ax, 'Average Hourly Traffic Volume', 'Hour of Day', 'Avg Total Vehicles')
    ax.annotate(f'Peak: {peak_h:02d}:00', xy=(peak_h, hourly_mean[peak_h]),
                xytext=(peak_h + 0.4, hourly_mean[peak_h] + 4),
                color=ORANGE, fontsize=8, fontweight='bold')
    _save('hourly.png')

    # ════════════════════════════════════════════════════════════════════════
    # 2. Daily Traffic Volume
    # ════════════════════════════════════════════════════════════════════════
    DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    daily_mean = df.groupby('Day of the week')['Total'].mean().reindex(DAY_ORDER)

    fig, ax = plt.subplots(figsize=(10, 5), facecolor=BG)
    colors_d = [CYAN if v != daily_mean.max() else ORANGE for v in daily_mean.values]
    ax.bar(daily_mean.index, daily_mean.values,
           color=colors_d, alpha=0.8, edgecolor=(1, 1, 1, 0.1), linewidth=0.6)
    ax.set_xticks(range(len(DAY_ORDER)))
    ax.set_xticklabels(DAY_ORDER, rotation=20, ha='right', fontsize=9)
    _style_ax(ax, 'Average Daily Traffic Volume', 'Day of the Week', 'Avg Total Vehicles')
    _save('daily.png')

    # ════════════════════════════════════════════════════════════════════════
    # 3. Traffic Situation Distribution (donut)
    # ════════════════════════════════════════════════════════════════════════
    situation_counts = df['Traffic Situation'].value_counts()
    fig, ax = plt.subplots(figsize=(5, 4.5), facecolor=BG)
    wedge_colors = [RED, ORANGE, CYAN, GREEN][:len(situation_counts)]
    wedges, texts, autotexts = ax.pie(
        situation_counts.values,
        labels=None,                # no labels on slices
        autopct='%1.1f%%',
        colors=wedge_colors,
        pctdistance=0.78,
        wedgeprops={'width': 0.55, 'edgecolor': BG, 'linewidth': 2},
        startangle=90,
    )
    # Keep all pct text dark so it's readable on any wedge colour
    for at in autotexts:
        at.set_color(BG)
        at.set_fontsize(8.5)
        at.set_fontweight('bold')
    # Legend outside the donut
    ax.legend(
        wedges,
        [s.title() for s in situation_counts.index],
        loc='lower center',
        bbox_to_anchor=(0.5, -0.08),
        ncol=len(situation_counts),
        frameon=False,
        fontsize=9,
        labelcolor=WHITE,
    )
    ax.set_title('Traffic Situation Distribution', color=WHITE, fontsize=13, fontweight='bold', pad=14)
    fig.patch.set_facecolor(BG)
    _save('situation.png')

    # ════════════════════════════════════════════════════════════════════════
    # 4. Box Plot — Total Traffic by Traffic Situation
    # ════════════════════════════════════════════════════════════════════════
    sit_order = ['normal', 'heavy', 'high', 'low'] if set(['normal','heavy','high','low']).issubset(df['Traffic Situation'].str.lower().unique()) else df['Traffic Situation'].unique().tolist()
    df['Situation_lc'] = df['Traffic Situation'].str.lower()

    fig, ax = plt.subplots(figsize=(9, 5), facecolor=BG)
    box_palette = {s: c for s, c in zip(sit_order, [CYAN, RED, ORANGE, GREEN])}
    for i, sit in enumerate(sit_order):
        subset = df[df['Situation_lc'] == sit]['Total']
        if subset.empty:
            continue
        bp = ax.boxplot(subset, positions=[i], widths=0.5, patch_artist=True,
                        medianprops=dict(color=WHITE, linewidth=2),
                        whiskerprops=dict(color=MUTED, linewidth=1),
                        capprops=dict(color=MUTED, linewidth=1),
                        flierprops=dict(
                            marker='o',
                            markerfacecolor=WHITE,
                            markeredgecolor=box_palette.get(sit, CYAN),
                            markeredgewidth=0.8,
                            alpha=0.7,
                            markersize=4
                        ))
        for patch in bp['boxes']:
            patch.set_facecolor(box_palette.get(sit, CYAN))
            patch.set_alpha(0.55)

    ax.set_xticks(range(len(sit_order)))
    ax.set_xticklabels([s.title() for s in sit_order], fontsize=10)
    _style_ax(ax, 'Traffic Volume Distribution by Situation', 'Traffic Situation', 'Total Vehicles')
    _save('boxplot.png')

    # ════════════════════════════════════════════════════════════════════════
    # 5. Vehicle Composition — Stacked Area (by hour)
    # ════════════════════════════════════════════════════════════════════════
    hourly_veh = df.groupby('Hour')[VEHICLE_COLS].mean().reindex(range(24), fill_value=0)
    fig, ax = plt.subplots(figsize=(12, 5), facecolor=BG)
    veh_colors = [CYAN, PURPLE, GREEN, ORANGE]
    ax.stackplot(hourly_veh.index, hourly_veh.T.values,
                 labels=VEHICLE_COLS, colors=veh_colors, alpha=0.72)
    ax.set_xticks(range(24))
    ax.set_xticklabels([f'{h:02d}:00' for h in range(24)], rotation=45, ha='right', fontsize=7.5)
    ax.legend(loc='upper left', facecolor=PANEL, edgecolor=(1, 1, 1, 0.1),
              labelcolor=WHITE, fontsize=8)
    _style_ax(ax, 'Hourly Vehicle Composition (Stacked Area)', 'Hour of Day', 'Avg Vehicle Count')
    _save('composition.png')

    # ════════════════════════════════════════════════════════════════════════
    # 6. Correlation Heatmap
    # ════════════════════════════════════════════════════════════════════════
    corr_cols = VEHICLE_COLS + ['Total', 'Hour']
    corr = df[corr_cols].corr()
    fig, ax = plt.subplots(figsize=(8, 6), facecolor=BG)
    cmap = sns.diverging_palette(130, 30, s=90, l=50, as_cmap=True)  # green ↔ orange
    sns.heatmap(corr, ax=ax, cmap=cmap, annot=True, fmt='.2f',
                linewidths=0.5, linecolor=(1, 1, 1, 0.05),
                annot_kws={'size': 8, 'color': WHITE},
                cbar_kws={'shrink': 0.8})
    ax.set_title('Feature Correlation Heatmap', color=WHITE, fontsize=13, fontweight='bold', pad=14)
    ax.tick_params(colors=MUTED, labelsize=9)
    ax.set_facecolor(PANEL)
    plt.setp(ax.get_xticklabels(), rotation=30, ha='right')
    plt.setp(ax.get_yticklabels(), rotation=0)
    _save('heatmap.png')

    # ════════════════════════════════════════════════════════════════════════
    # 7. Vehicle Type Scatter — CarCount vs Total coloured by Situation
    # ════════════════════════════════════════════════════════════════════════
    fig, ax = plt.subplots(figsize=(9, 5), facecolor=BG)
    sit_colors_map = {'normal': CYAN, 'heavy': RED, 'high': ORANGE, 'low': GREEN}
    for sit, grp in df.groupby('Situation_lc'):
        ax.scatter(grp['CarCount'], grp['Total'],
                   color=sit_colors_map.get(sit, MUTED),
                   alpha=0.35, s=18, label=sit.title(), rasterized=True)
    legend_patches = [mpatches.Patch(color=c, label=s.title())
                      for s, c in sit_colors_map.items() if s in df['Situation_lc'].unique()]
    ax.legend(handles=legend_patches, facecolor=PANEL,
              edgecolor=(1, 1, 1, 0.1), labelcolor=WHITE, fontsize=8)
    _style_ax(ax, 'Car Count vs Total Traffic (by Situation)', 'Car Count', 'Total Vehicles')
    _save('scatter.png')

    # ════════════════════════════════════════════════════════════════════════
    # Statistics payload
    # ════════════════════════════════════════════════════════════════════════
    stats = {
        "total_records":         len(df),
        "peak_hour":             int(hourly_mean.idxmax()),
        "busiest_day":           str(daily_mean.idxmax()),
        "avg_total_traffic":     round(float(df['Total'].mean()), 2),
        "most_common_situation": str(df['Traffic Situation'].mode()[0]),
        "plots": [
            {
                "key":      "hourly",
                "file":     "hourly.png",
                "title":    "Hourly Traffic Volume",
                "context":  f"Bar chart of average total vehicles per hour (0-23). Peak hour is {int(hourly_mean.idxmax()):02d}:00 with {round(float(hourly_mean.max()), 1)} avg vehicles. The overall dataset average is {round(float(df['Total'].mean()), 1)}."
            },
            {
                "key":      "daily",
                "file":     "daily.png",
                "title":    "Daily Traffic Volume",
                "context":  f"Bar chart of average daily traffic. Busiest day: {daily_mean.idxmax()} ({round(float(daily_mean.max()),1)} avg vehicles). Quietest: {daily_mean.idxmin()} ({round(float(daily_mean.min()),1)})."
            },
            {
                "key":      "situation",
                "file":     "situation.png",
                "title":    "Traffic Situation Distribution",
                "context":  f"Donut chart of traffic situation labels. Counts: {dict(situation_counts)}. Most common: {situation_counts.idxmax()} ({round(100*situation_counts.max()/situation_counts.sum(), 1)}%)."
            },
            {
                "key":      "boxplot",
                "file":     "boxplot.png",
                "title":    "Box Plot — Traffic by Situation",
                "context":  "Box plot showing the spread, median, and outliers of total vehicle counts for each traffic situation category."
            },
            {
                "key":      "composition",
                "file":     "composition.png",
                "title":    "Vehicle Composition (Stacked Area)",
                "context":  f"Stacked area chart showing how cars, bikes, buses, and trucks each contribute to total traffic across the 24-hour day. Cars dominate with avg {round(float(df['CarCount'].mean()),1)}/hr."
            },
            {
                "key":      "heatmap",
                "file":     "heatmap.png",
                "title":    "Feature Correlation Heatmap",
                "context":  f"Pearson correlation matrix between vehicle type counts, total, and hour. CarCount↔Total correlation: {round(float(df['CarCount'].corr(df['Total'])), 2)}."
            },
            {
                "key":      "scatter",
                "file":     "scatter.png",
                "title":    "Car Count vs Total Traffic",
                "context":  "Scatter plot of CarCount (x) against Total (y), coloured by traffic situation. Shows how car density drives overall congestion levels."
            },
        ]
    }

    with open(os.path.join(PLOTS_DIR, 'stats.json'), 'w') as f:
        json.dump(stats, f)


if __name__ == "__main__":
    run_eda()
    print("EDA completed successfully.")
