import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Share,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView, PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import { StatusBar } from 'expo-status-bar';
import Slider from '@react-native-community/slider';
import { startInpainting, pollForCompletion, generatePlan, pollForPlan } from './src/api';
import { saveSession, loadSession, saveTasks, clearSession } from './src/storage';
import { BrushMaskScreen } from './src/BrushMaskScreen';
import { CleaningTask } from '@klear/shared';

type AppStep = 'home' | 'preview' | 'mask' | 'timeBudget' | 'processing' | 'result' | 'tasks';
type TimeBudget = '15min' | '1hr' | 'weekend';

// Local interface removed in favor of shared type

const TIME_BUDGETS = {
  '15min': { label: '15 Minutes', description: 'Quick wins only', icon: '⚡', maxTasks: 3 },
  '1hr': { label: '1 Hour', description: 'Solid progress', icon: '🎯', maxTasks: 8 },
  'weekend': { label: 'Weekend', description: 'Deep clean', icon: '🏠', maxTasks: 15 },
};

const SAMPLE_TASKS: CleaningTask[] = [
  { id: '1', title: 'Clear desk surface', description: 'Remove items, wipe down, keep essentials only', estimatedMinutes: 5, priority: 'high', completed: false, area: 'Desk', status: 'pending' },
  { id: '2', title: 'Organize loose cables', description: 'Bundle and route cables neatly', estimatedMinutes: 8, priority: 'high', completed: false, area: 'Cables', status: 'pending' },
  { id: '3', title: 'Put away dishes', description: 'Take cups/plates to kitchen', estimatedMinutes: 3, priority: 'high', completed: false, area: 'General', status: 'pending' },
  { id: '4', title: 'Sort papers', description: 'File, recycle, or action pile', estimatedMinutes: 10, priority: 'medium', completed: false, area: 'Papers', status: 'pending' },
  { id: '5', title: 'Dust surfaces', description: 'Wipe down all visible surfaces', estimatedMinutes: 8, priority: 'medium', completed: false, area: 'General', status: 'pending' },
  { id: '6', title: 'Empty trash', description: 'Empty bins and replace bags', estimatedMinutes: 3, priority: 'medium', completed: false, area: 'General', status: 'pending' },
  { id: '7', title: 'Organize shelf items', description: 'Arrange books and items neatly', estimatedMinutes: 10, priority: 'low', completed: false, area: 'Shelves', status: 'pending' },
  { id: '8', title: 'Vacuum floor', description: 'Vacuum entire floor area', estimatedMinutes: 12, priority: 'low', completed: false, area: 'Floor', status: 'pending' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const [step, setStep] = useState<AppStep>('home');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [maskData, setMaskData] = useState<string | null>(null);
  const [cleanedImage, setCleanedImage] = useState<string | null>(null);
  const [timeBudget, setTimeBudget] = useState<TimeBudget>('1hr');
  const [processingStatus, setProcessingStatus] = useState<string>('Starting...');
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [strength, setStrength] = useState(0.85);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Load saved session on mount
  useEffect(() => {
    loadSession().then(session => {
      if (session && session.tasks.length > 0) {
        // Resume previous session
        setSelectedImage(session.originalImage);
        setCleanedImage(session.cleanedImage);
        setTimeBudget(session.timeBudget as TimeBudget);
        setTasks(session.tasks);
        setStep('tasks');
      }
    });
  }, []);

  // Save tasks whenever they change
  useEffect(() => {
    if (tasks.length > 0) {
      saveTasks(tasks);
    }
  }, [tasks]);

  // Focus Mode Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(sec => {
          if (sec <= 1) {
            setIsTimerActive(false);
            triggerHaptic('success');
            return 0;
          }
          return sec - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timerSeconds]);

  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'success' | 'error') => {
    switch (type) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  }, []);

  const processAndSetImage = async (uri: string) => {
    try {
      // Resize to max 1024px on the longest side for better AI performance and stability
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      
      setSelectedImage(result.uri);
      setSelectedImageBase64(`data:image/jpeg;base64,${result.base64}`);
      setStep('preview');
      triggerHaptic('success');
    } catch (err) {
      console.error('Error processing image:', err);
      Alert.alert('Error', 'Failed to process image. Please try again.');
      triggerHaptic('error');
    }
  };

  const pickImage = async () => {
    triggerHaptic('light');
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1, // High quality before manual resize
    });

    if (!result.canceled && result.assets[0]) {
      await processAndSetImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    triggerHaptic('light');
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1, // High quality before manual resize
    });

    if (!result.canceled && result.assets[0]) {
      await processAndSetImage(result.assets[0].uri);
    }
  };

  const handleContinueToTimeBudget = () => {
    triggerHaptic('light');
    setStep('mask');
  };

  const handleMaskComplete = (mask: string) => {
    triggerHaptic('medium');
    setMaskData(mask);
    setStep('timeBudget');
  };

  const handleStartProcessing = async () => {
    if (!selectedImageBase64 || !maskData) {
      Alert.alert('Error', 'No image or mask data available');
      return;
    }

    triggerHaptic('medium');
    setStep('processing');
    setProcessingStatus('Uploading to AI...');
    setError(null);

    try {
      const { predictionId } = await startInpainting(selectedImageBase64, maskData, {
        strength,
        guidance_scale: guidanceScale,
      });
      
      const resultUrl = await pollForCompletion(predictionId, (status) => {
        if (status === 'processing') {
          setProcessingStatus('AI is cleaning your space...');
        } else if (status === 'starting') {
          setProcessingStatus('Preparing AI models...');
        }
      });

      setCleanedImage(resultUrl);
      setStep('result');
      triggerHaptic('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Processing failed';
      setError(errorMessage);
      setStep('preview');
      triggerHaptic('error');
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);
    await handleStartProcessing();
    setIsRetrying(false);
  };

  const handleViewTasks = async () => {
    if (!selectedImageBase64) return;

    triggerHaptic('medium');
      setStep('processing');
      setProcessingStatus('Analyzing room clutter...');
      setError(null);

      try {
        const { predictionId } = await generatePlan(selectedImageBase64, timeBudget);
        
        const realTasks = await pollForPlan(predictionId, timeBudget, (status) => {
          if (status === 'processing') {
            setProcessingStatus('Identifying objects...');
          } else if (status === 'starting') {
            setProcessingStatus('Consulting cleaning AI...');
          }
        });

        setTasks(realTasks.map((t: any) => ({ ...t, completed: false })));
        
        // Save session
        if (selectedImage && cleanedImage) {
          saveSession({
            originalImage: selectedImage,
            cleanedImage: cleanedImage,
            timeBudget,
            tasks: realTasks,
            createdAt: new Date().toISOString(),
          });
        }
        
        setStep('tasks');
        triggerHaptic('success');
      } catch (err) {
        console.error('Plan generation failed:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to create plan';
        setError(errorMessage);
        setStep('result');
        triggerHaptic('error');
        Alert.alert('Analysis Note', `Could not generate a personalized plan: ${errorMessage}. Using default tasks instead.`, [
          { 
            text: 'Proceed with Defaults', 
            onPress: () => {
              const maxTasks = TIME_BUDGETS[timeBudget].maxTasks;
              setTasks(SAMPLE_TASKS.slice(0, maxTasks).map(t => ({ ...t, completed: false })));
              setStep('tasks');
            } 
          }
        ]);
      }
  };

  const handleSharePlan = async () => {
    try {
      const completedTasks = tasks.filter(t => t.completed).length;
      const totalTasks = tasks.length;
      const totalMins = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
      
      let message = `✨ My Klear Cleaning Plan\n\n`;
      message += `I'm transforming my space! 🏠\n`;
      message += `📊 Progress: ${completedTasks}/${totalTasks} tasks done\n`;
      message += `⏱️ Estimated time: ${totalMins} minutes\n\n`;
      message += `Tasks:\n`;
      tasks.forEach((t) => {
        message += `${t.completed ? '✅' : '⬜'} ${t.title}\n`;
      });
      message += `\nCleaned with Klear AI ✨`;

      await Share.share({
        message,
        title: 'My Klear Plan',
      });
      triggerHaptic('success');
    } catch (error) {
      console.error('Error sharing plan:', error);
    }
  };

  const startTaskTimer = (minutes: number) => {
    setTimerSeconds(minutes * 60);
    setIsTimerActive(true);
    triggerHaptic('medium');
  };

  const toggleFocusMode = () => {
    triggerHaptic('medium');
    setIsFocusMode(!isFocusMode);
    if (!isFocusMode) {
      // Find first incomplete task
      const firstIncomplete = tasks.findIndex(t => !t.completed);
      setCurrentTaskIndex(firstIncomplete !== -1 ? firstIncomplete : 0);
    }
  };

  const nextFocusTask = () => {
    triggerHaptic('light');
    const nextIndex = tasks.findIndex((t, i) => i > currentTaskIndex && !t.completed);
    if (nextIndex !== -1) {
      setCurrentTaskIndex(nextIndex);
      setIsTimerActive(false);
      setTimerSeconds(0);
    } else {
      setIsFocusMode(false);
      Alert.alert('All done!', 'You\'ve reached the end of your focus list.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleTask = (taskId: string) => {
    triggerHaptic('light');
    setTasks(prev => {
      const updated = prev.map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      
      // Check if all completed
      const allCompleted = updated.every(t => t.completed);
      if (allCompleted) {
        triggerHaptic('success');
      }
      
      return updated;
    });
  };

  const handleReset = async () => {
    triggerHaptic('light');
    await clearSession();
    setSelectedImage(null);
    setSelectedImageBase64(null);
    setMaskData(null);
    setCleanedImage(null);
    setTasks([]);
    setError(null);
    setStep('home');
  };

  const handleSliderGesture = useCallback((event: PanGestureHandlerGestureEvent) => {
    const { x } = event.nativeEvent;
    const containerWidth = SCREEN_WIDTH - 48;
    const newPos = Math.max(0, Math.min(100, (x / containerWidth) * 100));
    setSliderPosition(newPos);
  }, []);

  const completedCount = tasks.filter(t => t.completed).length;
  const totalMinutes = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  // ============ HOME SCREEN ============
  if (step === 'home') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.logo}>✨ Klear</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>See your space, transformed</Text>
          <Text style={styles.subtitle}>
            Take a photo of your messy room and get a personalized cleaning plan
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={takePhoto}>
              <Text style={styles.primaryButtonText}>📷 Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
              <Text style={styles.secondaryButtonText}>🖼️ Choose from Library</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Your photos are processed securely</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============ PREVIEW SCREEN ============
  if (step === 'preview' && selectedImage) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.previewContent}>
          <Text style={styles.previewTitle}>Your Space</Text>
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
              <TouchableOpacity 
                style={styles.retryButton} 
                onPress={handleRetry}
                disabled={isRetrying}
              >
                <Text style={styles.retryButtonText}>
                  {isRetrying ? 'Retrying...' : 'Try Again'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleContinueToTimeBudget}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
              <Text style={styles.secondaryButtonText}>Choose Different Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ============ MASK SCREEN ============
  if (step === 'mask' && selectedImage) {
    return (
      <BrushMaskScreen
        imageUri={selectedImage}
        onComplete={handleMaskComplete}
        onBack={() => { triggerHaptic('light'); setStep('preview'); }}
      />
    );
  }

  // ============ TIME BUDGET SCREEN ============
  if (step === 'timeBudget') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { triggerHaptic('light'); setStep('mask'); }}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.timeBudgetContainer} contentContainerStyle={styles.timeBudgetContent}>
          <Text style={styles.timeBudgetTitle}>How much time do you have?</Text>
          <Text style={styles.timeBudgetSubtitle}>We'll create a plan that fits your schedule</Text>

          <View style={styles.timeBudgetOptions}>
            {(Object.entries(TIME_BUDGETS) as [TimeBudget, typeof TIME_BUDGETS[TimeBudget]][]).map(([key, value]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.timeBudgetOption,
                  timeBudget === key && styles.timeBudgetOptionSelected
                ]}
                onPress={() => { triggerHaptic('light'); setTimeBudget(key); }}
              >
                <Text style={styles.timeBudgetIcon}>{value.icon}</Text>
                <Text style={[
                  styles.timeBudgetLabel,
                  timeBudget === key && styles.timeBudgetLabelSelected
                ]}>{value.label}</Text>
                <Text style={styles.timeBudgetDesc}>{value.description}</Text>
                {timeBudget === key && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleStartProcessing}>
            <Text style={styles.primaryButtonText}>Generate Clean View ✨</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.advancedToggle} 
            onPress={() => { triggerHaptic('light'); setShowAdvanced(!showAdvanced); }}
          >
            <Text style={styles.advancedToggleText}>
              {showAdvanced ? '🔼 Hide Advanced Options' : '🔽 Show Advanced Options'}
            </Text>
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.advancedContainer}>
              <View style={styles.sliderGroup}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.sliderLabel}>Strength (Creativity)</Text>
                  <Text style={styles.sliderValue}>{strength.toFixed(2)}</Text>
                </View>
                <Text style={styles.sliderDesc}>Higher = more creative, Lower = closer to original</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  value={strength}
                  onValueChange={setStrength}
                  minimumTrackTintColor="#3b82f6"
                  maximumTrackTintColor="#d1d5db"
                  thumbTintColor="#3b82f6"
                />
              </View>

              <View style={styles.sliderGroup}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.sliderLabel}>Guidance (Precision)</Text>
                  <Text style={styles.sliderValue}>{guidanceScale.toFixed(1)}</Text>
                </View>
                <Text style={styles.sliderDesc}>Higher = follows prompt strictly</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={20}
                  value={guidanceScale}
                  onValueChange={setGuidanceScale}
                  minimumTrackTintColor="#3b82f6"
                  maximumTrackTintColor="#d1d5db"
                  thumbTintColor="#3b82f6"
                />
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============ PROCESSING SCREEN ============
  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <StatusBar style="dark" />
        <View style={styles.processingContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.processingTitle}>{processingStatus}</Text>
          <Text style={styles.processingSubtitle}>This usually takes 15-30 seconds</Text>
          
          <View style={styles.processingDots}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.dot, { opacity: 0.3 + (i * 0.3) }]} />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ============ RESULT SCREEN (Before/After) ============
  if (step === 'result' && selectedImage && cleanedImage) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.backButton}>← Start Over</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.resultContent}>
          <Text style={styles.resultTitle}>Your space, transformed</Text>
          <Text style={styles.resultSubtitle}>Drag to compare before and after</Text>

          <PanGestureHandler onGestureEvent={handleSliderGesture}>
            <View style={styles.compareContainer}>
              {/* After image (bottom layer) */}
              <Image source={{ uri: cleanedImage }} style={styles.compareImage} />
              
              {/* Before image (top layer, clipped) */}
              <View style={[styles.compareOverlay, { width: `${sliderPosition}%` }]}>
                <Image source={{ uri: selectedImage }} style={styles.compareImageBefore} />
                <View style={styles.labelBefore}>
                  <Text style={styles.labelText}>Before</Text>
                </View>
              </View>
              
              <View style={styles.labelAfter}>
                <Text style={styles.labelText}>After</Text>
              </View>

              {/* Slider */}
              <View style={[styles.sliderLine, { left: `${sliderPosition}%` }]}>
                <View style={styles.sliderHandle}>
                  <Text style={styles.sliderIcon}>⟷</Text>
                </View>
              </View>
            </View>
          </PanGestureHandler>

          <View style={styles.feedbackRow}>
            <Text style={styles.feedbackLabel}>How does this look?</Text>
            <View style={styles.feedbackButtons}>
              <TouchableOpacity 
                style={styles.feedbackButton}
                onPress={() => triggerHaptic('light')}
              >
                <Text>👍 Great</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.feedbackButton}
                onPress={() => triggerHaptic('light')}
              >
                <Text>👎 Needs work</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleViewTasks}>
            <Text style={styles.primaryButtonText}>Create Cleaning Plan</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============ TASKS SCREEN ============
  if (step === 'tasks') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { triggerHaptic('light'); setStep('result'); }}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Plan</Text>
          <TouchableOpacity onPress={toggleFocusMode}>
            <Text style={[styles.backButton, isFocusMode && { color: '#ef4444' }]}>
              {isFocusMode ? 'Exit Focus' : 'Focus Mode'}
            </Text>
          </TouchableOpacity>
        </View>

        {isFocusMode && tasks[currentTaskIndex] ? (
          <View style={styles.focusContainer}>
            <View style={styles.focusCard}>
              <Text style={styles.focusArea}>{tasks[currentTaskIndex].area}</Text>
              <Text style={styles.focusTitle}>{tasks[currentTaskIndex].title}</Text>
              <Text style={styles.focusDescription}>{tasks[currentTaskIndex].description}</Text>
              
              <View style={styles.timerContainer}>
                {isTimerActive ? (
                  <Text style={styles.timerText}>{formatTime(timerSeconds)}</Text>
                ) : (
                  <TouchableOpacity 
                    style={styles.startTimerButton}
                    onPress={() => startTaskTimer(tasks[currentTaskIndex].estimatedMinutes)}
                  >
                    <Text style={styles.startTimerText}>Start {tasks[currentTaskIndex].estimatedMinutes}m Timer</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity 
                style={[styles.primaryButton, { width: '100%' }]}
                onPress={() => {
                  toggleTask(tasks[currentTaskIndex].id);
                  nextFocusTask();
                }}
              >
                <Text style={styles.primaryButtonText}>Done & Next</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.secondaryButton, { width: '100%', marginBottom: 0 }]}
                onPress={nextFocusTask}
              >
                <Text style={styles.secondaryButtonText}>Skip for now</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.focusProgress}>
              <Text style={styles.focusProgressText}>Task {currentTaskIndex + 1} of {tasks.length}</Text>
            </View>
          </View>
        ) : (
          <ScrollView style={styles.tasksContent}>
            {/* Progress */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Your cleaning plan</Text>
                <Text style={styles.progressCount}>{completedCount}/{tasks.length} tasks</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(completedCount / tasks.length) * 100}%` }]} />
              </View>
              <Text style={styles.progressTime}>Estimated time: {totalMinutes} min</Text>
            </View>

            {/* Tasks */}
            {tasks.map(task => (
              <TouchableOpacity 
                key={task.id} 
                style={[styles.taskCard, task.completed && styles.taskCardCompleted]}
                onPress={() => toggleTask(task.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.taskCheckbox, task.completed && styles.taskCheckboxChecked]}>
                  {task.completed && <Text style={styles.taskCheckmark}>✓</Text>}
                </View>
                <View style={task.completed ? styles.taskContent : styles.taskContent}>
                  <View style={styles.taskHeader}>
                    <Text style={[styles.taskTitle, task.completed && styles.taskTitleCompleted]}>
                      {task.title}
                    </Text>
                    <View style={[
                      styles.priorityBadge,
                      task.priority === 'high' && styles.priorityHigh,
                      task.priority === 'medium' && styles.priorityMedium,
                      task.priority === 'low' && styles.priorityLow,
                    ]}>
                      <Text style={styles.priorityText}>{task.priority}</Text>
                    </View>
                  </View>
                  <Text style={styles.taskDescription}>{task.description}</Text>
                  <Text style={styles.taskTime}>{task.estimatedMinutes} min</Text>
                </View>
              </TouchableOpacity>
            ))}

            {completedCount === tasks.length && tasks.length > 0 && (
              <View style={styles.completionCard}>
                <Text style={styles.completionEmoji}>🎉</Text>
                <Text style={styles.completionTitle}>Amazing work!</Text>
                <Text style={styles.completionText}>You've completed all your cleaning tasks</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.primaryButton, { marginTop: 24 }]} onPress={handleSharePlan}>
              <Text style={styles.primaryButtonText}>📤 Share My Progress</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
              <Text style={styles.secondaryButtonText}>Clean Another Room</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  containerCentered: {
    flex: 1,
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  logo: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  backButton: {
    fontSize: 16,
    color: '#3b82f6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 12,
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  previewContent: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Time budget styles
  timeBudgetContainer: {
    flex: 1,
  },
  timeBudgetContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  timeBudgetTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  timeBudgetSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  // Focus Mode styles
  focusContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  focusCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  focusArea: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  focusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 16,
  },
  focusDescription: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  timerContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  timerText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1a1a1a',
    fontVariant: ['tabular-nums'],
  },
  startTimerButton: {
    backgroundColor: '#eff6ff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 100,
  },
  startTimerText: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 16,
  },
  focusProgress: {
    marginTop: 32,
    alignItems: 'center',
  },
  focusProgressText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  timeBudgetOptions: {
    gap: 12,
  },
  timeBudgetOption: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  timeBudgetOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  timeBudgetIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  timeBudgetLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  timeBudgetLabelSelected: {
    color: '#3b82f6',
  },
  timeBudgetDesc: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  checkmark: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Processing styles
  processingContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 24,
    textAlign: 'center',
  },
  processingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  processingDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
  },
  // Result styles
  resultContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  compareContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
    position: 'relative',
  },
  compareImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  compareOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  compareImageBefore: {
    width: SCREEN_WIDTH - 48,
    height: '100%',
    position: 'absolute',
    left: 0,
  },
  labelBefore: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  labelAfter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  labelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sliderLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#fff',
    marginLeft: -2,
  },
  sliderHandle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    backgroundColor: '#fff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderIcon: {
    fontSize: 18,
    color: '#374151',
  },
  feedbackRow: {
    marginTop: 20,
    alignItems: 'center',
  },
  feedbackLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  feedbackButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  // Tasks styles
  tasksContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  progressCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 4,
  },
  progressTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  taskCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  taskCardCompleted: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  taskCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskCheckboxChecked: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  taskCheckmark: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  taskContent: {
    flex: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  taskDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  taskTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  priorityHigh: {
    backgroundColor: '#fef2f2',
  },
  priorityMedium: {
    backgroundColor: '#fefce8',
  },
  priorityLow: {
    backgroundColor: '#f0fdf4',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  completionCard: {
    backgroundColor: '#f0fdf4',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginVertical: 16,
  },
  completionEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  completionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 4,
  },
  completionText: {
    fontSize: 14,
    color: '#15803d',
  },
  advancedToggle: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  advancedToggleText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  advancedContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sliderGroup: {
    marginBottom: 20,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
  },
  sliderDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
});
