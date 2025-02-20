# Contributing to Tangent

Welcome to the Tangent project! We're excited you're interested in contributing. This document will help you get started.

## Project Overview

Tangent is an AI chat canvas that grows with you. Instead of a linear chat interface, it's a canvas where you can branch off into different threads and explore ideas organically.

## Project Structure

Here's a brief overview of the project structure:

*   `tangent-ui/`: Contains all frontend code using React.
    *   `src/components/`: React components for the UI.
        *   `chat/`: Components related to the chat interface.
        *   `visualization/`: Components for the visualization canvas.
        *   `shared/`: Shared components used across the app.
        *   `core/`: Core components for styling and functionality.
        *   `feedback/`: Feedback and metrics components
        *   `forms/`: Components for handling user forms.
        *   `layout/`: Components for application layouts
        *   `providers/`: Context providers
        *   `navigation/`: Navigation components
        *   `overlay/`: Overlay components
        *   `interpreter/`: Python and React preview components
    *   `src/utils/`: Utility functions.
    *   `src/index.js`: Entry point for the UI.
*   `tangent-api/`: Python backend code using Flask for processing and embeddings.
    *   `src/`: Main application code
    *   `routes/`: API endpoints
    *   `services/`: Business logic and processing services

## Areas Needing Help

We'd love your help with:

*   **Backend Overhaul (`tangent-api/`):**
    *   Implementing fuzzy matching or sentence-wise embedding matching for better reflection analysis.
    *   Refactoring for better organization and readability
    *   Making the API OpenAI compatible.

*   **Frontend Improvements (`tangent-ui/`):**
    *   Cleaning up hardcoded configurations.
    *   Adding a proper configuration system (e.g., using config file).
    *   Improving the overall code organization and file structure.
    *   Implementing keyboard shortcuts
    *   Adding more unit tests.

*   **Feature Enhancements:**
    *   Adding a Python interpreter for running/debugging scripts in chat.
    *   Implementing a React-based Artifacts feature (like Claude's).
    *   Enhancing multi-modal implementation for image drag & drop.

## Getting Started

1.  Fork the repository.
2.  Clone your fork to your local machine.
3.  Install dependencies for the frontend and backend:
    ```bash
    # For frontend, go to the simplified-ui directory
    cd simplified-ui
    npm install
    # For backend, requirements.txt is provided
    pip install -r requirements.txt
    ```
4.  Create a new branch for your changes: `git checkout -b my-feature`
5.  Make your changes and commit them.
6.  Push your branch to your fork: `git push origin my-feature`
7.  Create a pull request.

## Code Conventions

*   Use descriptive names for variables and functions.
*   Add comments to explain complex logic.
*   Follow a consistent style (e.g. using Prettier).

## Contact

Open up a ticket to start any discussions.

Discord server will be up soon!
