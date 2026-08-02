# Requirements

## Functional Requirements:

- Users can upload an image of an object
- The system analyzes the image using AI models
- The system identifies the waste category
- The system recommends the correct waste bin
- The system displays AI confidence information
- Users can provide feedback about predictions
- The system stores feedback for evaluation
- The system calculates historical model performance
- Users can compare different AI models
- The system stores analysis results in SQLite databases
- The system shall provide a feedback flow for correct, wrong, and unknown predictions

## Non-functional Requirements:

- Image upload should complete within **1 seconds**.
- Users shall be able to complete an analysis in **no more than two steps**.
- New waste categories shall be added without modifying the user interface.
- The application shall support the latest versions of **Chrome, Firefox, and Edge**.
- The system shall display a meaningful error message if the AI analysis fails instead of crashing.
- The system shall process requests locally through LM Studio instead of external cloud APIs.
- The system should keep documentation free of private IP addresses and machine-specific local paths.

## Notes on Current Implementation

- HTTPS is not implemented in the repository itself and therefore is not listed as a guaranteed project feature.
- The current code uses hardcoded LM Studio connection values and should later move them into configuration.
- The project currently has no automated tests.
