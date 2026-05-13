"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppData } from '@/types/storage';
import { UserSettings } from '@/types/settings';
import { LeaveRecord } from '@/types/leave';
import { Holiday } from '@/types/holiday';
import { loadAppData, saveAppData, defaultAppData } from '@/lib/storage';

interface AppDataContextType {
  appData: AppData;
  isLoaded: boolean;
  updateSettings: (settings: Partial<UserSettings>) => void;
  updateLeaveRecords: (records: LeaveRecord[]) => void;
  updateHolidays: (holidays: Holiday[]) => void;
  resetData: () => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [appData, setAppData] = useState<AppData>(defaultAppData);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const data = loadAppData();
    // eslint-disable-next-line
    setAppData(data);
    // eslint-disable-next-line
    setIsLoaded(true);
  }, []);

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setAppData(prev => {
      const updated = { ...prev, settings: { ...prev.settings, ...newSettings } };
      saveAppData(updated);
      return updated;
    });
  };

  const updateLeaveRecords = (records: LeaveRecord[]) => {
    setAppData(prev => {
      const updated = { ...prev, leaveRecords: records };
      saveAppData(updated);
      return updated;
    });
  };

  const updateHolidays = (newHolidays: Holiday[]) => {
    setAppData(prev => {
      const updated = { ...prev, holidays: newHolidays };
      saveAppData(updated);
      return updated;
    });
  };

  const resetData = () => {
    setAppData(defaultAppData);
    localStorage.removeItem('leave_app_data');
  };

  return (
    <AppDataContext.Provider value={{ appData, isLoaded, updateSettings, updateLeaveRecords, updateHolidays, resetData }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}
