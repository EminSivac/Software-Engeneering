# Architecture & Design

## System Overview

The application is built as a local AI-based waste classification system.  
The user uploads an image through the web interface. The backend processes the request, sends the image information to local AI models running through LM Studio, and stores the results for later evaluation.

The system consists of four main components:

```
                User
                 |
                 v
        Frontend (HTML/CSS/JS)
                 |
                 v
        Node.js Express Backend
                 |
        -----------------
        |               |
        v               v
   LM Studio API     SQLite Database
        |
        v
  Vision Language Models
  - Qwen
  - Gemma
  - Ministral

```

The frontend never communicates directly with LM Studio. All communication is handled through the backend.

---

# Components

## Frontend

### Responsibilities

The frontend provides the user interface for interacting with the system.

It handles:

- Image upload
- Displaying detected waste objects
- Showing predictions from multiple AI models
- Comparing model results
- Displaying historical evaluation metrics
- Collecting user feedback

### Technology

- HTML
- CSS
- JavaScript

---

## Backend

### Responsibilities

The backend is responsible for the main application logic.

It handles:

- Receiving image uploads
- Managing analysis requests
- Maintaining the processing queue
- Communicating with LM Studio
- Processing AI responses
- Storing prediction results
- Processing user feedback
- Calculating model evaluation metrics

### Technology

- Node.js
- Express
- Multer
- CORS
- LM Studio SDK
- SQLite 3

### Request Flow

1. User uploads an image.
2. Backend creates an analysis job.
3. The job is added to the processing queue.
4. The Vision Language Model identifies the object.
5. Multiple AI models classify the waste.
6. Results are stored in the database.
7. Frontend receives and displays the results.

---

## LM Studio

### Responsibilities

LM Studio provides the local AI inference environment.

It is responsible for:

- Running Vision Language Models locally
- Processing images
- Generating waste classification predictions

### Used Models

The system currently compares:

- Ministral
- Gemma
- Qwen

Using multiple models allows evaluating differences in performance between models.

---

## Database

### Responsibilities

The database stores information needed for evaluation and feedback.

The system uses SQLite databases for:

- AI predictions
- User feedback
- Corrected waste categories
- Historical model evaluation

### Stored Data

Prediction results:

- Model name
- Predicted waste category
- Actual category (after feedback)
- Correctness
- Processing time

Feedback data:

- User response
- Selected correction
- Timestamp
- Additional prediction information

---

# Key Design Decisions

## Local AI Instead of Cloud AI

### Decision

The system uses locally running AI models through LM Studio instead of external AI APIs.

### Reasoning

Advantages:

- Images stay locally processed
- No external API costs
- Better privacy
- Can work without internet access

---

## Multiple AI Models

### Decision

The system compares multiple Large Language Models instead of using only one model.

### Reasoning

Different models can have different strengths.

For example:

- One model might classify plastic very accurately.
- Another model might perform better on paper or organic waste.

This makes it possible to evaluate which model performs best for specific waste categories.

---

## Feedback-Based Evaluation

### Decision

User feedback is used as validation data for model evaluation.

### Reasoning

AI predictions alone cannot show whether a model is actually correct.  
By collecting user corrections, the system creates a dataset of verified examples.

This allows calculating metrics such as:

- Prediction Reliability (Precision)
- Category Detection Rate (Recall)

---

## Asynchronous Processing Queue

### Decision

Image analysis requests are processed through a queue instead of immediately running all requests.

### Reasoning

AI inference can take several seconds, especially when comparing multiple models.

The queue:

- Prevents multiple heavy AI processes from running at the same time
- Shows the user the current processing status
- Allows multiple users/jobs to be handled safely

---

# Design Summary

The architecture separates user interaction, application logic, AI processing, and data storage.

This separation makes the system easier to maintain and extend. New AI models can be added without changing the frontend, and additional evaluation metrics can be implemented using the collected feedback data.
