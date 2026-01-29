# Paragraph Memorization App

A React-based web application for memorizing paragraphs through interactive word hiding and practice sessions.

## Features

- **Text Input**: Enter paragraphs you want to memorize
- **Word Selection**: Choose specific words to practice
- **Interactive Practice**: Click rectangles to reveal/hide words
- **Save System**: Store up to 30 memorization exercises
- **Responsive Design**: Works on all device sizes

## Architecture

### Component Structure

```
src/
├── components/
│   ├── Navigation/         # Fixed top navigation bar
│   ├── TextInput/          # Text entry form
│   ├── WordSelection/      # Word selection interface
│   ├── MemorizationView/   # Practice interface
│   └── SavedContent/       # Saved exercises list
├── context/
│   └── AppContext.tsx      # Global state management
├── types/
│   └── index.ts            # TypeScript interfaces
├── utils/
│   └── textProcessor.ts    # Text parsing utilities
└── test/                   # Unit tests
```

### Key Principles

- **Single Responsibility**: Each component handles one specific function
- **Modular Architecture**: Clear separation of concerns
- **Props Interface**: Clean data flow between components  
- **Context State Management**: Shared state via React Context
- **Component Isolation**: Independent, testable components

## Development

### Setup
```bash
npm install
npm run dev
```

### Testing
```bash
npm test          # Run unit tests
npm run test:ui   # Run tests with UI
```

### Build
```bash
npm run build     # Production build
npm run preview   # Preview production build
```

## Usage

1. **Create New Exercise**: Click "New" → Enter text → Select words → Practice
2. **Save Exercise**: Click "Save" during practice to store for later
3. **Practice Saved**: Click "Saved" → Select exercise → Practice
4. **Word Practice**: Click rectangles to reveal words, click words to hide again

## Technical Details

- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Font**: Times New Roman (as requested)
- **Storage**: localStorage for persistence
- **Testing**: Vitest with Testing Library
- **State**: React Context + useState
- **Word Processing**: Custom text parsing with hyphen support

## Component APIs

### TextInput
```typescript
interface TextInputProps {
  onNext: (text: string) => void;
}
```

### WordSelection  
```typescript
interface WordSelectionProps {
  text: string;
  onNext: (words: Word[], selectedIndices: number[]) => void;
  onBack: () => void;
}
```

### MemorizationView
```typescript  
interface MemorizationViewProps {
  words: Word[];
  selectedIndices: number[];
  originalText: string;
  onBack: () => void;
  onSave: () => void;
}
```

## License

MIT License