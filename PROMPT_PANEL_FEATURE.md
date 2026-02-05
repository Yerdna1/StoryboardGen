# Prompt Panel Generation Display Feature

## Overview
The StoryboardGen application now automatically displays previously generated panels when you click on a prompt in the left panel.

## How It Works

### User Interaction
1. Click on any prompt in the left "Prompts" panel
2. If that prompt has any previous generations:
   - The most recent generation's panels will automatically load
   - Panels appear in the right-side grid view
3. If no generations exist, the panel area remains empty

### Technical Implementation

#### Database Structure
- Generations are linked to prompts via `prompt_id` in the database
- Each generation stores:
  - `id`: Unique generation identifier
  - `prompt_id`: Reference to the prompt used
  - `output_images`: JSON array of generated panel data
  - `created_at`: Timestamp for sorting

#### Code Changes

1. **Electron Preload** (`electron/preload.js`)
   - Added `getGenerations(promptId)` method to fetch generations by prompt

2. **Type Definitions** (`src/global.d.ts`)
   - Added TypeScript type for the new API method

3. **PromptsPanel Component** (`src/components/PromptsPanel.tsx`)
   - New `handlePromptSelect` function that:
     - Sets the selected prompt
     - Fetches generations for that prompt
     - Loads the most recent generation's panels

#### Data Flow
```
User clicks prompt → handlePromptSelect()
                   → window.electronAPI.getGenerations(promptId)
                   → Database query (ORDER BY created_at DESC)
                   → Load panels into StoryboardGrid
```

## Benefits

- **Quick Review**: Instantly see what was generated for each prompt
- **No Manual Loading**: Automatic display without extra clicks
- **History Access**: View past generations without navigating through menus
- **Seamless Workflow**: Switch between prompts to compare results

## Future Enhancements

Consider adding:
- Generation history selector (not just the most recent)
- Thumbnail previews in the prompt list
- Generation count badges on prompts
- Option to pin favorite generations