# Problem Definition

## Background

Correct waste sorting is often confusing in practice. Many objects are difficult to classify quickly, especially when packaging materials, mixed materials, or unclear labels are involved.

This project explores whether local AI models can help users make better waste sorting decisions from an image of an item.

## Core Problem

The main problem addressed by the project is:

How can a user upload a photo of an item and receive a useful waste-sorting recommendation while also comparing the behavior of multiple local AI models?

## Project Goal

The goal is not only to return one classification result, but also to evaluate model quality over time.

The system therefore combines:

- image-based item recognition
- waste category prediction
- waste-bin recommendation
- user feedback collection
- historical model evaluation

## Why a Local Setup Is Important

The project is designed around local inference through LM Studio.

This supports:

- privacy-conscious processing
- lower dependence on external APIs
- reduced cloud cost
- experimentation with different local models

## Practical Challenges

The project has to deal with several real-world challenges:

- images may be blurry or incomplete
- some items are hard to map to one category
- models may return inconsistent JSON
- different models may disagree
- reliable evaluation requires verified user feedback

## Resulting Product Direction

Because of these challenges, the project is not just a classifier. It is also a comparison and evaluation tool for local AI-assisted waste sorting.
