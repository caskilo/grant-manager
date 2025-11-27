# Discovery Workflow Outputs

This folder contains all outputs from the Opportunity Discovery workflow.

## Structure

```
discovery/
├── sources/
│   └── sources.json          # Configuration of data sources
├── runs/
│   └── YYYY-MM-DD/          # One folder per discovery run
│       ├── raw/             # Raw downloaded/copied data
│       ├── parsed/          # Structured JSON from parsing
│       └── summary/         # Human and machine-readable summaries
└── README.md                # This file
```

## Review Process

1. Discovery runner produces outputs in `runs/<date>/`
2. Review `summary/discovery-summary.md` for proposed changes
3. Optionally apply changes to database via integration script
4. Commit changes to git for version control

## Key Documents

- [Opportunity Discovery Plan](../../docs/Opportunity-Discovery-Plan.md)
- [Original Feature Spec](../Opportunity-Discovery.md)
- [Progress Tracker](../../docs/PROGRESS.md)
