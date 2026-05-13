# UniHub Sample Data

`students_2026-05-12.csv` and `students_2026-05-14.csv` are sample nightly exports from the legacy student system.

Expected CSV header:

```csv
studentId,fullName,email
```

When imported, new student accounts use this default password pattern:

```text
{studentId}@UniHub
```
