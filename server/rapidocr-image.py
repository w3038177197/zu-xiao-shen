import json
import sys
import time

from rapidocr_onnxruntime import RapidOCR


def main():
    if len(sys.argv) < 2:
        raise SystemExit("missing image path")

    image_path = sys.argv[1]
    started = time.time()
    engine = RapidOCR()
    result, engine_elapsed = engine(image_path)
    items = []

    for item in result or []:
        try:
            _box, text, score = item
        except ValueError:
            continue
        text = str(text).strip()
        if not text:
            continue
        items.append({"text": text, "score": float(score)})

    avg_score = sum(item["score"] for item in items) / len(items) if items else 0
    print(json.dumps({
        "engine": "rapidocr",
        "elapsed": time.time() - started,
        "engineElapsed": engine_elapsed,
        "count": len(items),
        "avgScore": avg_score,
        "text": "\n".join(item["text"] for item in items),
        "items": items,
    }, ensure_ascii=True), flush=True)


if __name__ == "__main__":
    main()
