# Farm Creation Debug Report

## Issue Description
User reports that typing a single character "J" in the farm name field triggers an immediate farm save/creation, before clicking the "Save Farm" button.

## Investigation Status: INSTRUMENTATION ADDED

### Code Architecture Analysis

#### 1. NewFarmPage (`app/app/farms/new/page.tsx`)
- ✅ NO `<form>` element
- ✅ NO `useEffect` calling save
- ✅ `save` function only passed to MapEditor via `onSave` prop
- ✅ Name input only updates local state: `setName(value)`
- ✅ NO onBlur save logic

#### 2. MapEditor Component (`features/farm/MapEditor.tsx`)
- ✅ Save button has explicit `type="button"` (line 740)
- ✅ Save button onClick: `() => draftGeometry && void onSave(draftGeometry)` (line 745)
- ✅ Button properly disabled until conditions met
- ✅ NO useEffect calling onSave
- ✅ All useEffects are for: map init, coordinate sync, unsaved changes warning
- ✅ NO keyboard shortcuts calling save

#### 3. FarmNameInput Component
- ✅ Simple controlled input
- ✅ Only calls onChange prop
- ✅ NO side effects

#### 4. Input UI Component
- ✅ Basic wrapper around @base-ui Input
- ✅ NO special behavior or side effects

#### 5. Global Architecture
- ✅ NO FarmContext found
- ✅ NO useMutation hooks for farms
- ✅ NO global keyboard event listeners for save
- ✅ AppShell: NO effects
- ✅ Root Layout: NO effects (just QueryProvider)
- ✅ QueryProvider: Standard React Query setup, NO custom effects

### Farm Creation API Call Sites
**ONLY ONE CALL SITE FOUND:**
- File: `lib/api/farms.ts`
- Function: `createFarm`
- HTTP Method: POST
- Endpoint: `/api/v1/farms`

**NO OTHER MUTATION PATHS EXIST**

### Instrumentation Added

Added debug logging to `lib/api/farms.ts` `createFarm` function:
```typescript
console.error('[DEBUG] FARM CREATE CALLED', {
  farmName: data.name,
  timestamp: new Date().toISOString(),
});
console.trace('[DEBUG] FARM CREATE STACK');
```

This will log:
1. Every time createFarm is called
2. The farm name being created
3. A full stack trace showing WHO called it

## Expected Behavior (Post-Fix)

### Typing "J":
- Local state updates: `name = "J"`
- Button state: remains DISABLED (no valid boundary)
- Network requests: **0 POST /api/v1/farms**
- Console: NO debug logs

### Typing "James Farm":
- Local state updates: `name = "James Farm"`
- Button state: remains DISABLED (no valid boundary)
- Network requests: **0 POST /api/v1/farms**  
- Console: NO debug logs

### After Drawing Valid Boundary + Clicking "Save Farm":
- Network requests: **EXACTLY 1 POST /api/v1/farms**
- Console: 1 debug log with stack trace
- Farm name sent: "James Farm"

## Reproduction Steps (For Testing)

1. Open browser DevTools Console
2. Navigate to http://localhost:3000/app/farms/new
3. Complete boundary (draw 3+ points, close ring)
4. Focus farm name input
5. Type: `J`
6. **OBSERVE**: Check console for debug logs
7. **OBSERVE**: Check Network tab for POST /api/v1/farms
8. Continue typing: `ames Farm`
9. **OBSERVE**: Still no requests
10. Click "Save Farm" button
11. **OBSERVE**: Exactly ONE POST request with name "James Farm"

## Next Steps

### Step 1: Runtime Testing
With instrumentation in place, user should:
1. Reproduce the issue in browser
2. Check browser console for `[DEBUG] FARM CREATE CALLED` logs
3. Check Network tab for POST requests
4. Report findings:
   - Does debug log appear when typing "J"?
   - Does POST request appear when typing "J"?
   - What does the stack trace show?

### Step 2: If Issue Reproduced
If debug logs appear on typing:
- The stack trace will show exactly what called createFarm
- We'll fix that caller
- We'll add safeguards

### Step 3: If Issue NOT Reproduced
If NO debug logs appear on typing:
- Issue may be environment-specific
- Check for browser extensions
- Check for cached/stale code
- Verify correct page is loaded
- Hard refresh (Ctrl+Shift+R)

### Step 4: Defensive Fixes (Regardless of Reproduction)

Even if we can't reproduce, apply these defensive measures:

1. **Add save intent guard**:
```typescript
const saveIntentRef = useRef(false);

const handleSaveClick = () => {
  saveIntentRef.current = true;
  void save(geometry);
};

const save = async (geometry: GeoJSONPolygon) => {
  if (!saveIntentRef.current) {
    console.error('[BLOCKED] Farm creation without explicit save intent');
    return;
  }
  // ... rest of save logic
};
```

2. **Add duplicate prevention**:
```typescript
const [saving, setSaving] = useState(false);

const save = async (geometry: GeoJSONPolygon) => {
  if (saving) return; // Prevent duplicate calls
  setSaving(true);
  try {
    // ... save logic
  } finally {
    setSaving(false);
  }
}
```

3. **Explicit button wiring**:
- Already done ✅ (type="button")

## Files Modified

1. `farmtwin/frontend/lib/api/farms.ts` - Added debug instrumentation

## Files To Check If Issue Persists

1. Browser extensions (disable all)
2. Service workers (clear all)
3. Browser cache (hard refresh)
4. `.next` build cache (delete and rebuild)
5. Node modules (verify vinext/next versions)

## Cleanup After Resolution

Remove debug logging from `lib/api/farms.ts`:
```typescript
// DELETE THESE LINES:
console.error('[DEBUG] FARM CREATE CALLED', ...);
console.trace('[DEBUG] FARM CREATE STACK');
```
