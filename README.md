# ChatGPT

## PlanTool voor Studenten

Deze repository bevat een eenvoudig Python-script (`planner.py`) waarmee studenten hun huiswerk- en stageopdrachten kunnen plannen. Taken worden opgeslagen in `tasks.json`.

### Gebruik

```bash
# Een taak toevoegen (voorbeeld)
python3 planner.py add "Rapport schrijven" 2024-06-15 --type stage

# Alle taken tonen
python3 planner.py list
```

Deadlines moeten ingevoerd worden in het formaat `YYYY-MM-DD`.
