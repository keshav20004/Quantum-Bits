import csv
import io


def generate_csv(results: list[dict]) -> bytes:
    """Converts a list of scored resume results to CSV bytes."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Rank", "Filename", "Score", "Matching Skills", "Missing Skills", "Summary"
    ])
    
    # Sort by score descending and assign rank
    sorted_results = sorted(results, key=lambda r: r.get("score", 0), reverse=True)
    
    for rank, r in enumerate(sorted_results, 1):
        writer.writerow([
            rank,
            r.get("filename", ""),
            r.get("score", 0),
            ", ".join(r.get("matching_skills", [])),
            ", ".join(r.get("missing_skills", [])),
            r.get("summary", ""),
        ])
    
    return output.getvalue().encode("utf-8")
