// Storage utility for Klear mobile app
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  TASKS: '@klear/tasks',
  LAST_SESSION: '@klear/last_session',
};

export interface StoredSession {
  originalImage: string;
  cleanedImage: string;
  timeBudget: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    estimatedMinutes: number;
    priority: 'high' | 'medium' | 'low';
    completed: boolean;
  }>;
  createdAt: string;
}

export async function saveSession(session: StoredSession): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SESSION, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SESSION);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load session:', error);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.LAST_SESSION);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

export async function saveTasks(tasks: StoredSession['tasks']): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (error) {
    console.error('Failed to save tasks:', error);
  }
}

export async function loadTasks(): Promise<StoredSession['tasks'] | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load tasks:', error);
    return null;
  }
}
