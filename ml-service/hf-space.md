---
title: KezSpeak ML service
emoji: 🎙️
colorFrom: blue
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# KezSpeak ML service

Speech-to-text (Whisper small), acoustic and NLP features, and the XGBoost
pronunciation estimate for the KezSpeak web app. Machine scores are
assessment information that a tutor reviews; they are not official scores.

This Space only serves the API used by the KezSpeak site. Health check: `/health`.
Source and setup: the `ml-service/` folder of the KezSpeak repository.
