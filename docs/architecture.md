# Health App Architecture

This document describes the design, data flow, and component relationships of the Personal Health App.

## Component Hierarchy

The application layout consists of a bottom tab bar navigation controlling the main visible view, safe-area containers, and a keyboard-avoiding wrapper. The view switches between five primary tab states, rendering corresponding forms, lists, and utilities.

```mermaid
graph TD
    App["App (App.tsx)"] --> Summary["Summary Tab"]
    App --> Log["Log Tab"]
    App --> Trends["Trends Tab"]
    App --> Meds["Meds Tab"]
    App --> Settings["Settings Tab"]
    
    Summary --> GridPanel["GridPanel (BP & Weight Avg)"]
    Summary --> WeightGrid["WeightGrid (weigh-in summary)"]
    
    Log --> ReadingForm["ReadingForm"]
    Log --> WeightForm["WeightForm"]
    ReadingForm --> NumberField["NumberField"]
    WeightForm --> NumberField
    
    Trends --> RangeRow["Range Selector (7d / 30d / All)"]
    Trends --> TrendChart["TrendChart (SVG Chart & touch readout)"]
    Trends --> ReadingList["ReadingList"]
    Trends --> WeightList["WeightList"]
    
    Meds --> MedicationForm["MedicationForm (DateTimePicker, suggest chips)"]
    Meds --> MedicationList["MedicationList"]
    
    Settings --> UnitChips["UnitChips (st_lb / kg)"]
    Settings --> ReminderCard["ReminderCard"]
    ReminderCard --> DateTimePicker["DateTimePicker"]
```

---

## Data Flow & Storage

All user data is stored on-device only via `AsyncStorage`. Readings (blood pressure and heart rate) and weight logs are loaded into the React state when the application mounts, and updates are serialized and saved whenever logs are added or deleted.

```mermaid
flowchart LR
    subgraph UI ["UI Layer (React Native Components)"]
        Forms["ReadingForm / WeightForm / MedicationForm"]
        Lists["ReadingList / WeightList / MedicationList"]
    end

    subgraph State ["Application State (App.tsx)"]
        StateVars["State Variables (readings, weights, medications, reminderProblem)"]
    end

    subgraph Storage ["Storage Layer (src/storage.ts)"]
        AsyncStorage["AsyncStorage (device only)"]
    end

    Forms -- "On Save / Submit" --> StateVars
    StateVars -- "serialize & write" --> AsyncStorage
    AsyncStorage -- "load & parse (on App mount)" --> StateVars
    StateVars -- "render lists & summary" --> Lists
```

---

## Data Models

The key data models used within the application are defined in [src/types.ts](file:///Users/chriswelch/workspace/health-app/src/types.ts).

### Blood Pressure Reading (`BloodPressureReading`)
Stores logs of blood pressure measurements and heart rates.
*   **Storage Key:** `health-app/readings/v1`
*   **Structure:**
    ```typescript
    export type BloodPressureReading = {
      id: string;               // Unique string (Date.now() timestamp)
      takenAt: string;          // ISO 8601 timestamp of when taken
      systolic: number;         // Systolic pressure in mmHg
      diastolic: number;        // Diastolic pressure in mmHg
      heartRate: number | null; // Heart rate in bpm (optional)
      note?: string;            // Optional free-text notes
    };
    ```

### Weight Entry (`WeightEntry`)
Stores weight logs. To prevent rounding errors or precision loss from repeatedly switching unit preferences, weights are stored strictly in whole grams.
*   **Storage Key:** `health-app/weights/v1`
*   **Structure:**
    ```typescript
    export type WeightEntry = {
      id: string;
      takenAt: string;          // ISO 8601 timestamp of when taken
      grams: number;            // Weight in grams
      note?: string;            // Optional free-text notes
    };
    ```

### Medication Reminders (`MedicationReminder`)
Stores configured medication reminder alerts.
*   **Storage Key:** `health-app/medications/v1`
*   **Structure:**
    ```typescript
    export type MedicationReminder = {
      id: string;
      name: string;             // Medication name
      enabled: boolean;         // Active status
      times: { hour: number; minute: number }[]; // Up to 3 times daily
      instruction: string;      // Optional instructions (e.g. "After food")
    };
    ```

---
## Notification Scheduling Lifecycle

Reminders utilize local OS alarms. Since Android Expo Go SDK 53+ lacks support for `expo-notifications`, a runtime guard is used to lazily import the notification module only where supported, preserving core application functionality on Android Expo Go.

```mermaid
sequenceDiagram
    autonumber
    actor User as User Action
    participant App as App.tsx
    participant Note as src/notifications.ts
    participant Expo as expo-notifications (OS Native)

    Note->>Note: Check Platform (Android Expo Go Guard)
    alt Android && Expo Go (SDK 53+)
        Note-->>App: Return 'unsupported' status
        Note-->>App: Skip importing expo-notifications (prevent crash)
    else Supported Platform (iOS or Android Dev Build)
        User->>App: Toggle / Update Reminder Settings
        App->>Note: scheduleReminder(kind, settings) / scheduleMedicationReminders(med)
        Note->>Note: Check & request local notification permissions
        alt Permissions Denied
            Note-->>App: Return 'denied' status
        else Permissions Granted
            Note->>Expo: Get all scheduled notifications
            Note->>Expo: Cancel previous matching reminders
            alt Settings.enabled == true
                Note->>Expo: Schedule Daily (BP/Meds) or Weekly (Weight) trigger
                Note-->>App: Return 'scheduled' status
            else Settings.enabled == false
                Note-->>App: Return 'cancelled' status
            end
        end
    end
```
