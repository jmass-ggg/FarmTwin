# Farm Creation Bug - Reproduction Test Instructions

## Current Status
- **Bug CONFIRMED**: Farm with name "a" was created
- **Instrumentation ADDED**: Both frontend and backend now have debug logging
- **Next Step**: Reproduce to capture stack trace

## Test Procedure

### Step 1: Clear Existing Data
1. Delete the farm with name "a" from the database (or just start fresh)
2. Refresh the page hard (Ctrl+Shift+R)

### Step 2: Open Developer Tools
1. Press F12 to open DevTools
2. Go to **Console** tab
3. Go to **Network** tab
4. Filter Network by: `farms`
5. Clear both Console and Network logs

### Step 3: Start Test
1. Navigate to: http://localhost:3000/app/farms/new
2. **Draw a complete boundary**:
   - Click map 3+ times to create corners
   - Double-click to close the ring
   - Verify "Boundary is ready to save" message
3. **Scroll to farm name input** at the top of the page

### Step 4: Critical Test - Type ONE Character

**IMPORTANT**: Follow these steps EXACTLY:

1. Click into the "Farm name" field at the top
2. Type ONLY the letter: `a`
3. **DO NOT press Enter**
4. **DO NOT press Tab**
5. **DO NOT click anywhere else**
6. **Just wait 2 seconds**

###Step 5: Check Results

#### In Browser Console:
Look for: `[DEBUG] FARM CREATE CALLED`

**If you see it:**
- ✅ Bug reproduced!
- Copy the ENTIRE stack trace
- Send it to me

**If you DON'T see it:**
- Continue to Step 6

#### In Network Tab:
Look for: POST request to `/api/v1/farms`

**If you see it:**
- ✅ Bug reproduced!
- Click the request
- Go to "Headers" tab
- Copy Request Headers
- Go to "Payload" tab  
- Copy Request Payload
- Send both to me

**If you DON'T see it:**
- Continue to Step 6

### Step 6: Test Enter Key

If Step 4 didn't trigger the bug, try this:

1. Clear Console and Network logs
2. Farm name field still has "a" in it
3. **Press Enter key**
4. Check Console and Network again

**If THIS triggers the bug:**
- The issue is Enter key handling
- Copy stack trace and send it

### Step 7: Test Tab Key

If Enter didn't trigger it either:

1. Reload page (lose the "a")
2. Redraw boundary
3. Type "a" in farm name
4. **Press Tab key**
5. Check Console and Network

### Step 8: Test Clicking Away

If Tab didn't trigger it:

1. Reload page
2. Redraw boundary
3. Type "a" in farm name
4. **Click on the map**
5. Check Console and Network

## Backend Logs

While doing the above tests, also check the terminal where uvicorn is running.

Look for:
```
[DEBUG BACKEND] CREATE FARM REQUEST RECEIVED:
  Farm name: a
  ...
```

Copy the entire output including the stack trace.

## What to Report Back

Send me:

1. **Which action triggered the bug?**
   - Just typing "a"?
   - Typing "a" + Enter?
   - Typing "a" + Tab?
   - Typing "a" + clicking away?

2. **Browser Console Output:**
   ```
   Paste the [DEBUG] logs here
   ```

3. **Network Request Details:**
   - Request URL
   - Request Method
   - Request Payload (the JSON body)
   - Timestamp

4. **Backend Terminal Output:**
   ```
   Paste the [DEBUG BACKEND] logs here
   ```

5. **Stack Trace from Frontend:**
   ```
   Paste the JavaScript stack trace here
   ```

## Expected Results (After Fix)

| Action | Console Logs | Network POST |
|--------|-------------|--------------|
| Type "a" | 0 | 0 |
| Type "a" + Enter | 0 | 0 |
| Type "a" + Tab | 0 | 0 |
| Type "a" + click away | 0 | 0 |
| Click "Save Farm" button | 1 with stack | 1 |

## Important Notes

- The farm was created, so SOMETHING triggered it
- The instrumentation will tell us WHAT
- Don't guess - let the logs tell us
- The stack trace is the key evidence

## If You Can't Reproduce

If you follow all steps and can't reproduce the bug:

1. Check if the farm "a" still exists
2. Try deleting it and starting completely fresh
3. Try a different browser
4. Try incognito/private mode
5. Check if any browser extensions are interfering

## After Successful Reproduction

Once we have the stack trace showing what called `createFarm`, we can:
1. Identify the exact code path
2. Fix the root cause
3. Add preventive measures
4. Create regression tests
