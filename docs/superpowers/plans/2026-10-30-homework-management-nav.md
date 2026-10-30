# Homework Management navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** One sidebar item for Homework Management; three top tabs in Missing → English → Record order.

**Architecture:** Reuse `AdminHomeworkManagementPage` tab shell. Sidebar drops the two extra homework links. Old routes redirect with `Navigate`.

**Tech Stack:** React Router, existing homework components, AdminLayout.

### Task 1: Tabs and sidebar

- Update `AdminHomeworkManagementPage` tab labels/ids and embed Homework Record on `record`
- Remove English Tracker and Homework Summary from `AdminLayout` nav
- Redirect `/admin/english-homework` and `/admin/homework-summary` in `App.tsx`
- Update `.agent/codebase_manifest.md`

### Task 2: Ship

- Commit, push, open PR
