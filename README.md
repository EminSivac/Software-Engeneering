# AI Waste Classification Comparison

This project is a local web application for comparing how multiple LM Studio models classify a waste item from an uploaded image.

The application:

- uploads an image through a browser UI
- detects the item shown in the image
- asks multiple local models to classify the waste category
- shows the predicted waste bin for each model
- stores results in SQLite
- collects user feedback to evaluate model performance over time

## Current Project Scope

The current implementation is a lightweight Node.js application with:

- an Express backend in `server.js`
- a static frontend in `public/`
- image uploads handled with Multer
- local model access through the LM Studio SDK
- two SQLite databases:
  - `results.db` for prediction history
  - `feedback.db` for user feedback

This is not a cloud service and does not currently include:

- authentication
- user accounts
- automated tests
- Docker setup
- environment-based configuration
- HTTPS setup inside the repository

## How It Works

1. A user uploads an image in the browser.
2. The backend creates a queued analysis job.
3. One model is used to identify the object in the image.
4. Multiple models classify the waste category for that object.
5. The backend stores the prediction results.
6. The frontend polls the job status and displays the results.
7. The user can submit feedback for each model result.

## Tech Stack

- Node.js
- Express
- Multer
- CORS
- `@lmstudio/sdk`
- `better-sqlite3`
- HTML, CSS, and vanilla JavaScript

## Project Structure

```text
.
|-- server.js
|-- package.json
|-- public/
|   |-- index.html
|   `-- style.css
|-- docs/
|   |-- ai-reflection.md
|   |-- architecture.md
|   |-- problem-definition.md
|   `-- requirements.md
|-- uploads/
|-- results.db
`-- feedback.db
```

## Prerequisites

- Node.js 18 or newer
- LM Studio running locally or on a trusted reachable host
- The required models downloaded in LM Studio

The code currently expects LM Studio to be reachable over WebSocket on port `1234`.

## Setup

```bash
npm install
npm start
```

Then open the application in your browser at:

```text
http://localhost:3000
```

## Model Configuration

The currently configured models in `server.js` are:

- `ministral-3-3b-instruct-2512`
- `google/gemma-4-e4b`
- `qwen/qwen3.5-9b`

The object detection step currently uses:

- `qwen/qwen3.5-9b`

## API Overview

### `POST /analyze`

Accepts a multipart form upload with the field name `image`.

Response:

```json
{
  "jobId": "..."
}
```

### `GET /status/:id`

Returns the status of a queued or completed job.

### `POST /feedback`

Stores user feedback for a model prediction and updates evaluation data when the user marks a result as correct or wrong.

## Stored Evaluation Data

The application calculates two metrics from verified feedback:

- Prediction Reliability
- Category Detection Rate

These metrics are shown per model and category when enough feedback data exists.

## Security and Privacy Notes

- The README intentionally does not expose concrete private IP addresses or machine-specific paths.
- Uploaded images are written to the `uploads/` directory.
- The repository currently does not show cleanup logic for uploaded files after processing.
- Database files are stored locally in SQLite format.
- If this project is used outside a local trusted environment, configuration and transport security should be reviewed first.

## Documentation Check

The Markdown files in `docs/` only partially overlap with the actual project state:

- `docs/architecture.md`: mostly matches the implemented architecture. It correctly describes the frontend, backend, LM Studio integration, queue, feedback flow, and SQLite-based evaluation at a high level.
- `docs/requirements.md`: partially overlaps. The functional requirements are close to the project, but some non-functional requirements are not reflected in the codebase, especially HTTPS and measurable performance guarantees.
- `docs/ai-reflection.md`: currently empty and does not document the project.
- `docs/problem-definition.md`: currently empty and does not document the project.

Related note:

- `documentation.md` in the repository root matches the implemented feedback and evaluation logic better than the empty files in `docs/`.

## Known Gaps Between Docs and Code

- The code contains hardcoded LM Studio connection values instead of a documented environment-based setup.
- The frontend language is currently German, while this README is in English.
- There are no automated tests even though the project has evaluation-related logic that would benefit from them.
- The repository still includes local database files, which may not be ideal for distribution.

## License

See `LICENSE`.
