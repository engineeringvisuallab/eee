# N arm c4b vertical preview: ground vs DP road level. Run: python3 tools/j1-n-profile-plot.py docs
import json, sys, numpy as np, matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
d = sys.argv[1] if len(sys.argv) > 1 else 'docs'
A = json.load(open(f'{d}/j1c4b_align.json'))
g = np.array(A['ground']); y = np.array(A['level']); ds = A['levelDs']; s = np.arange(len(g)) * ds + 340  # chainage from J1 centre
fig, ax = plt.subplots(2, 1, figsize=(16, 8), sharex=True, gridspec_kw={'height_ratios': [3, 1]})
a = ax[0]
a.fill_between(s, g, y, where=g > y, color='tab:red', alpha=.45, label='cut (centre)')
a.fill_between(s, g, y, where=g < y, color='tab:blue', alpha=.45, label='fill (centre)')
a.plot(s, g, 'k', lw=1.5, label='ground'); a.plot(s, y, 'r', lw=2, label='road level (grade <= 3 %)')
a.axhline(0, lw=0)
for x, t in [(340 + c, 'rail crossing') for c in A['railCrossS']]: a.axvline(x, color='m', ls='--'); a.text(x, a.get_ylim()[1], t, color='m', rotation=90, va='top', ha='right')
a.set_ylabel('level (m)'); a.legend(loc='upper right'); a.set_title(f"N arm c4b profile: max cut {A['cutMax']:.1f} m, max fill {A['fillMax']:.1f} m, length {A['length']:.0f} m from S (J1 + 340 m)"); a.grid(alpha=.3)
cf = g - y; b = ax[1]
b.fill_between(s, cf, 0, where=cf > 0, color='tab:red', alpha=.6); b.fill_between(s, cf, 0, where=cf < 0, color='tab:blue', alpha=.6)
b.axhline(12, color='r', ls=':'); b.text(s[0], 12.3, 'cut limit 12 m', color='r'); b.axhline(-7, color='b', ls=':'); b.text(s[0], -6.7, 'viaduct above 7 m fill', color='b')
b.set_ylabel('cut (+) / fill (-) (m)'); b.set_xlabel('chainage from J1 centre (m)'); b.grid(alpha=.3)
plt.tight_layout(); plt.savefig(f'{d}/j1_n_profile.png', dpi=110); print('saved')
