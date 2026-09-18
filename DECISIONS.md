# Architectural & Product Decisions

### DP1 - The Nudge
When the user crosses their weekly CO2 target, the application displays a prominent, non-blocking warning banner with actionable reduction suggestions. We chose to warn and encourage rather than shame or block the user because punitive UX creates resentment and discourages daily logging. Positive reinforcement and transparent data visibility promote long-term sustainable behavior.

### DP2 - Absurd Input
Unrealistically high entries (e.g., a 500,000 km car trip or single-entry electricity > 500 kWh) trigger a confirmation warning modal before submission. We allow users to confirm if intentional while preventing fat-finger typos from distorting historical metrics. This balances data integrity with user autonomy without silently rejecting or breaking the application.

### DP3 - The Week
The week is defined strictly as Monday 00:00 to Sunday 23:59 (ISO standard calendar week). Mid-week progress is visualized using a dynamic budget progress bar showing the percentage of the weekly limit consumed relative to the days elapsed. This structure matches standard work-week cadences and makes weekly carbon budgeting intuitive.
