# Spaced Repetition Learning System Implementation

## Overview

A complete spaced repetition learning system with multiple choice questions has been successfully implemented. This system uses the SM-2 (SuperMemo 2) algorithm to scientifically space out question reviews based on student performance, maximizing retention while minimizing study time.

## Key Features

### 1. Question Set Management
- **Manual Creation**: Add questions one by one with full customization
- **CSV Import**: Bulk upload questions in a standardized format
- **External Source Imports**:
  - Notion: Export database as JSON and import directly
  - Anki: Import Anki deck JSON files
  - Google Sheets: Import CSV from Google Sheets

### 2. Multiple Choice Question Format
- 4 answer choices per question
- Correct answer indicator
- Difficulty levels (easy, medium, hard)
- Optional explanations for each question
- Tags for organization

### 3. Spaced Repetition Algorithm (SM-2)
- Scientifically-proven SuperMemo 2 algorithm
- Automatic calculation of next review dates
- Ease factor adjustment based on performance
- Quality ratings from user responses
- Handles 5 confidence levels: 1-5 (again, hard, good, very good, easy)

### 4. Learning Session Features
- Interactive question card interface
- Real-time feedback on answer selection
- Response time tracking
- Progress indication (current question / total)
- Visual feedback (correct/incorrect, explanation display)

### 5. Motivational Elements
- Study streak tracking (current and longest)
- Daily practice logging
- Achievement badges for milestones:
  - Getting Started (10 cards mastered)
  - Making Progress (50 cards mastered)
  - Milestone Master (100 cards mastered)
  - Week Warrior (7-day streak)
  - Month Master (30-day streak)
  - Dedicated Learner (1000 attempts)

### 6. Analytics Dashboard
- Cards mastered count
- Current and longest streaks
- Total cards in system
- Cards due today indicator
- Session performance metrics
- Individual question performance

## Database Schema

### Tables Created

1. **spaced_repetition_sets**
   - Question set metadata and organization
   - Difficulty levels and publish status

2. **spaced_repetition_questions**
   - Individual questions with choices
   - Correct answers and explanations
   - Tags for categorization

3. **spaced_repetition_schedules**
   - SM-2 algorithm tracking per user-question
   - Ease factors, intervals, next review dates
   - Last review and quality ratings

4. **spaced_repetition_attempts**
   - User response history
   - Accuracy and timing data
   - Quality ratings for algorithm adjustment

5. **user_streaks**
   - Daily practice tracking
   - Current and longest streaks
   - Total cards learned and mastered

6. **user_achievements**
   - Earned badges and achievements
   - Timestamp of achievement

7. **set_assignments**
   - Teacher-to-student set assignments
   - Optional due dates

## Components Created

### Management Components
- `ImportSourceSelector` - Choose import method
- `ManualQuestionEntry` - Create questions manually
- `CSVImporter` - Parse and preview CSV uploads
- `ExternalSourceImporter` - Handle Notion, Anki, Google imports

### Learning Components
- `QuestionCard` - Main quiz interface
- `SessionSummary` - Post-session statistics
- `SpacedRepetitionHub` - Dashboard and set management

### Main Page Component
- `SpacedRepetitionPage` - Router and state manager for all spaced repetition features

## Utility Functions

### SM-2 Algorithm
- `calculateNextReview()` - Compute next review date and ease factor
- `getQualityRatingFromCorrectness()` - Auto-rate based on accuracy and speed
- `initializeSchedule()` - Setup new question schedule
- `getCardsDueToday()` - Fetch questions ready for review
- `calculateMasteredStatus()` - Determine mastery level
- `getAchievementUnlocked()` - Check for achievement milestones

### Import Parsers
- `parseCSVQuestions()` - Parse CSV format
- `parseNotionJSON()` - Parse Notion exports
- `parseAnkiJSON()` - Parse Anki deck files
- `parseGoogleSheetsCSV()` - Parse Google Sheets CSV
- `validateImportedQuestions()` - Validate question data

## Context & State Management

### SpacedRepetitionContext
Provides access to:
- Question sets and current set
- Questions and schedules
- User streak and achievement data
- Functions for creating sets, adding questions, recording attempts
- Methods for fetching cards due today

## Permission System

- New permission flag: `can_access_spaced_repetition` added to users table
- Admins have automatic access to all spaced repetition features
- Students only see sets they have access to
- Assignment system for distributing question sets to students

## User Experience Flow

### For Teachers/Admins
1. Navigate to "Spaced Repetition" from sidebar
2. Choose import method (manual, CSV, external)
3. Create and customize question set
4. Optionally assign to students
5. View analytics on student progress

### For Students
1. Navigate to "Spaced Repetition" from sidebar
2. See dashboard with cards due today
3. Start learning session
4. Answer questions with immediate feedback
5. View session summary and earn achievements
6. Track progress with streaks and badges

## Integration Points

- **Navigation**: Added to main navigation sidebar
- **App.tsx**: Integrated page routing and SpacedRepetitionProvider
- **AuthContext**: Permission checking for feature access
- **Supabase**: All data persisted with RLS policies
- **Types**: New TypeScript interfaces for all data models

## CSV Format Reference

```
Question Text | Choice A | Choice B | Choice C | Choice D | Correct Index | Explanation | Difficulty
```

Example:
```
What is the capital of France? | London | Paris | Berlin | Madrid | 1 | France is a country in Western Europe | easy
```

## API Functions

For future Edge Function implementations:
- `get_cards_due_today` - Fetch user's due cards for today
- `record_learning_session` - Batch record session results
- `get_user_statistics` - Aggregate learning statistics

## Security

- All tables have Row Level Security (RLS) enabled
- Users can only see/modify their own data
- Teachers can only assign their own sets
- Policies check authentication and ownership

## Performance Optimizations

- Indexes on frequently queried columns (user_id, next_review_date)
- Efficient pagination for large question sets
- Lazy loading of schedule data
- Batch operations for recording attempts

## Future Enhancements

- Audio questions and spoken answers
- Image-based questions
- Collaborative study groups
- Mobile app optimization
- Advanced analytics and reporting
- Leaderboards and social features
- Custom interval settings
- Question difficulty auto-adjustment
