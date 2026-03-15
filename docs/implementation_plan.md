# Architecture and Implementation Plan: Loyalty Offers AI Agent

This document outlines the architecture and implementation steps to build an AI agent capable of managing, recommending, and comparing loyalty offers while strictly adhering to data privacy and security standards.

## User Review Required
> [!IMPORTANT]
> Please review the proposed architecture, especially the compliance mechanisms (GDPR, PCI, PII), before we proceed to writing code. Once approved, I will set up a backend service to mock this functionality.

## Core Features Design

1. **Conversational Chat UI**: A responsive web/mobile frontend that acts as the primary user interface, allowing natural language queries for offers and rewards.
2. **Explicit Consent Management**: A robust UI and backend capability allowing users granular control to opt-in or opt-out of data tracking, AI processing, and location services at any time.
3. **Behavioral Analytics Engine**: A backend component that safely records user interactions and preferences to refine future recommendations without compromising PII.
4. **Notify for Offers**: An event-driven notification system that alerts users about expiring points, new high-value offers, or location-triggered deals.
5. **Compare Offers**: An AI prompt-chaining mechanism that retrieves multiple applicable offers, calculates their effective monetary value based on user habits, and presents a comparison summary.
6. **Suggest Based on Points**: Logic to continuously monitor a user's point balance against a catalog of rewards, pushing suggestions when the user can afford high-affinity items.
7. **Complementary Offers**: A recommendation engine (e.g., collaborative filtering or LLM-based semantic matching) that looks at recently redeemed offers and suggests logical follow-ups (e.g., Hotel booking -> Car rental offer).
8. **Location-based Comparison**: Utilizing mobile geofencing (latitude/longitude coordinates sent securely) to query a geospatial database for nearby partner offers and push notifications in real-time.

## Phase 5: Real LLM Orchestration Architecture

To move from simulated responses to a true Agentic workflow, we will implement an **LLM Orchestration Layer** in the Node.js backend:
- **Provider Choice**: We will integrate an LLM SDK (e.g., OpenAI API or Google Gemini API).
- **System Prompting & Context Injection**: The backend will dynamically inject the user's `pointsBalance` and explicitly fetched `offers` into the LLM system prompt, completely omitting PII.
- **Tool Calling (Function Calling)**: We will equip the LLM with strict functions, such as `get_applicable_offers(category)` or `calculate_point_yield(offer_id)`. The LLM will dictate when to call the database, and the Express backend will execute the Prisma queries safely.
- **Compliance Enforcement Layer**: A middleware function will inspect the final LLM string before returning it to the client to ensure no raw PII was hallucinated. Only anonymous user contexts are passed to the LLM API.
- **Streaming UI**: The Next.js chat interface will be updated to handle Server-Sent Events (SSE) or chunked responses to provide a typing effect as the LLM generates the loyalty comparison.

## Phase 6: Predictive ML Engine (Next Best Offer)

To provide true anticipatory intelligence, we will deploy a dedicated **Machine Learning Microservice** built with Python (`FastAPI`, `Scikit-learn`, `Pandas`).
- **NBO (Next Best Offer) Model**: We will implement a Collaborative Filtering or classification model that predicts the probability of a user converting on an offer based on their past `RedeemedOffer` history and real-time `AnalyticsEvent` patterns (e.g., heavily viewing 'Dining' offers).
- **Backend Integration Bridge**: When a user queries the Express API, the Node.js server will first ping the Python ML Microservice at a `/predict/nbo?anonymousId=xyz` endpoint.
- **LLM Contextualization**: The Express server will inject the Top 3 predicted NBO offers directly into the OpenAI System Prompt.
- **Agent Synthesis**: Our GPT-4 Agent will synthesize the raw ML mathematical predictions into beautiful, conversational sales pitches (e.g., *"I noticed you enjoy dining out—based on your recent activities, our model predicts you would love this 3x Points Restaurant Offer..."*).

## Phase 7: Production Scale Architecture (Enterprise Grade)

To elevate this MVP into a globally scalable, enterprise system, we will inject the following infrastructure components:
1. **Containerization Ecosystem**: We will write optimal, multi-stage `Dockerfile`s for the React Frontend, Node.js Backend, and Python ML Service, orchestrated locally by `docker-compose.prod.yml`.
2. **True Identity & Authentication**: We will integrate an IdP (e.g., Auth0 or NextAuth) to issue secure JWTs, replacing the mocked `anonymousId`, allowing users to literally log in and view their exact vaulted point balances.
3. **Geospatial Processing (PostGIS)**: The Prisma database layer will be upgraded to support Earth-spherical calculations, allowing the backend to trigger LLM "Near Me" context based on true overlapping latitude/longitude geofences.
4. **Asynchronous Processing (Redis + BullMQ)**: We will add a scalable Redis instance. This provides caching for the heavy ML predictions and acts as a Message Broker (BullMQ) for a background task that "Pushes" expiration notifications to the user asynchronously.
5. **PII Tokenizer Vault Stub**: We will implement a specialized middleware that simulates connecting to an enterprise token vault (like Skyflow/VGS), enforcing the hard boundary where User Profile details (Email/Name) are completely stripped before entering the main orchestration bus.

## Compliance and Security Architecture

> [!CAUTION]
> Compliance is the most critical aspect of this system. The AI Agent must never ingest raw PII into external LLM APIs.

- **GDPR (General Data Protection Regulation)**:
  - **Consent Management**: Users must explicitly opt-in to location tracking, analytics tracking, and AI-driven automated decision making via clear UI toggles. Users can opt-out at any time.
  - **Right to Erasure**: Implementation of a `delete_user_data` pipeline that purges all history and profile data from the system.
  - **Data Minimization**: The AI engine will only receive the minimum attributes necessary to make a recommendation.
- **PII (Personally Identifiable Information)**:
  - **Tokenization**: The core AI logic will operate entirely on anonymous UUIDs.
  - **Encryption**: All PII stored in the database will use AES-256 encryption at rest. Transport will utilize TLS 1.2+.
  - **Data Masking**: Before sending context to any LLM, a sanitization layer will strip names, exact raw addresses (converting to generic geohashes), and contact info.
- **PCI-DSS (Payment Card Industry Data Security Standard)**:
  - **Out-of-Scope Design**: The agent infrastructure will **NOT** process, store, or transmit Credit Card PANs or CVVs. Card-linked offers will rely on standardized secure tokens provided by a compliant third-party payment gateway.

## Proposed System Components

### `Frontend Application` (Next.js / React)
The user-facing chat interface that works across web and mobile. Handles state management for the conversation and explicit rendering of privacy opt-in/opt-out dialogs.
### `Backend API & Agent Service` (Node.js/Express or Fastify)
The brain of the operation. Orchestrates calls between the LLM, the PostgreSQL Data Layer, and the Notification Layer.
### `Relational Database` (PostgreSQL)
Stores user profiles, analytics histories, explicit consent flags, and offer catalogs. PII is encrypted at the storage layer.
### `Sanitization Middleware`
Intercepts all prompts going to the AI model to ensure zero PII leakage.
### `Geo-Service`
A microservice optimized for spatial queries (e.g., using PostGIS or Redis GEOSearch) to find localized offers quickly.

## Verification Plan
- **Automated Tests**: Unit tests mocking LLM responses and validating that the Data Masking middleware effectively scrubs mock PII data.
- **Manual Verification**: We will create a small simulation script or dashboard to simulate a "User" walking into a geofence, earning points, and receiving a secure context-aware recommendation without exposing personal data.
