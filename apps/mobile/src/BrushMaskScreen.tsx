import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Canvas,
  Path,
  Skia,
  useCanvasRef,
  SkPath,
  Image as SkiaImage,
  useImage,
  Circle,
  PaintStyle,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_PADDING = 24;
const CANVAS_WIDTH = SCREEN_WIDTH - CANVAS_PADDING * 2;

interface BrushMaskScreenProps {
  imageUri: string;
  onComplete: (maskBase64: string) => void;
  onBack: () => void;
}

interface PathData {
  path: SkPath;
  strokeWidth: number;
}

export function BrushMaskScreen({ imageUri, onComplete, onBack }: BrushMaskScreenProps) {
  const [brushSize, setBrushSize] = useState(40);
  const [paths, setPaths] = useState<PathData[]>([]);
  const [currentPath, setCurrentPath] = useState<SkPath | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useCanvasRef();
  
  const image = useImage(imageUri);
  
  // Calculate canvas height based on image aspect ratio
  const imageAspectRatio = image ? image.width() / image.height() : 4 / 3;
  const canvasHeight = CANVAS_WIDTH / imageAspectRatio;

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const panGesture = Gesture.Pan()
    .onStart((e) => {
      triggerHaptic();
      const path = Skia.Path.Make();
      path.moveTo(e.x, e.y);
      setCurrentPath(path);
      setCursorPosition({ x: e.x, y: e.y });
    })
    .onUpdate((e) => {
      if (currentPath) {
        currentPath.lineTo(e.x, e.y);
        setCurrentPath(currentPath);
        setCursorPosition({ x: e.x, y: e.y });
      }
    })
    .onEnd(() => {
      if (currentPath) {
        setPaths((prev) => [...prev, { path: currentPath, strokeWidth: brushSize }]);
        setCurrentPath(null);
      }
      setCursorPosition(null);
    })
    .runOnJS(true)
    .minDistance(0);

  const handleClear = useCallback(() => {
    triggerHaptic();
    setPaths([]);
    setCurrentPath(null);
  }, [triggerHaptic]);

  const handleUndo = useCallback(() => {
    triggerHaptic();
    setPaths((prev) => prev.slice(0, -1));
  }, [triggerHaptic]);

  const generateMask = useCallback(() => {
    triggerHaptic();
    
    if (!image) {
      console.error('Image not loaded');
      return;
    }

    // Create an offscreen canvas for the mask
    const surface = Skia.Surface.Make(image.width(), image.height());
    if (!surface) {
      console.error('Could not create surface');
      return;
    }

    const canvas = surface.getCanvas();
    
    // Fill with black (areas to keep)
    canvas.clear(Skia.Color('black'));

    // Calculate scale from display size to actual image size
    const scaleX = image.width() / CANVAS_WIDTH;
    const scaleY = image.height() / canvasHeight;

    // Draw white paths (areas to inpaint/clean)
    const whitePaint = Skia.Paint();
    whitePaint.setColor(Skia.Color('white'));
    whitePaint.setStyle(PaintStyle.Stroke);
    whitePaint.setStrokeCap(StrokeCap.Round);
    whitePaint.setStrokeJoin(StrokeJoin.Round);
    whitePaint.setAntiAlias(false); // Pure binary mask, no anti-aliasing

    paths.forEach(({ path, strokeWidth }) => {
      // Scale the path to match the original image dimensions
      const scaledPath = path.copy();
      const matrix = Skia.Matrix();
      matrix.scale(scaleX, scaleY);
      scaledPath.transform(matrix);
      
      whitePaint.setStrokeWidth(strokeWidth * Math.max(scaleX, scaleY));
      canvas.drawPath(scaledPath, whitePaint);
    });

    // Get the image data as base64
    const snapshot = surface.makeImageSnapshot();
    const data = snapshot.encodeToBase64();
    const maskBase64 = `data:image/png;base64,${data}`;
    
    onComplete(maskBase64);
  }, [image, paths, canvasHeight, onComplete, triggerHaptic]);

  const adjustBrushSize = useCallback((delta: number) => {
    triggerHaptic();
    setBrushSize((prev) => Math.max(15, Math.min(80, prev + delta)));
  }, [triggerHaptic]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mark Clutter</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>
          Paint over items you want cleaned up
        </Text>

        {/* Brush size controls */}
        <View style={styles.brushControls}>
          <TouchableOpacity
            style={styles.brushButton}
            onPress={() => adjustBrushSize(-10)}
          >
            <Text style={styles.brushButtonText}>−</Text>
          </TouchableOpacity>
          
          <View style={styles.brushSizeIndicator}>
            <View style={[styles.brushDot, { width: brushSize / 2, height: brushSize / 2 }]} />
            <Text style={styles.brushSizeText}>{brushSize}px</Text>
          </View>
          
          <TouchableOpacity
            style={styles.brushButton}
            onPress={() => adjustBrushSize(10)}
          >
            <Text style={styles.brushButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Canvas with image and drawing */}
        <View style={[styles.canvasContainer, { height: canvasHeight }]}>
          {/* Background image */}
          <Image
            source={{ uri: imageUri }}
            style={[styles.backgroundImage, { height: canvasHeight }]}
            resizeMode="cover"
          />
          
          {/* Drawing overlay */}
          <GestureDetector gesture={panGesture}>
            <View style={StyleSheet.absoluteFill}>
              <Canvas style={styles.canvas} ref={canvasRef}>
                {/* Draw completed paths */}
                {paths.map((pathData, index) => (
                  <Path
                    key={index}
                    path={pathData.path}
                    color="rgba(239, 68, 68, 0.5)"
                    style="stroke"
                    strokeWidth={pathData.strokeWidth}
                    strokeCap="round"
                    strokeJoin="round"
                  />
                ))}
                
                {/* Draw current path */}
                {currentPath && (
                  <Path
                    path={currentPath}
                    color="rgba(239, 68, 68, 0.5)"
                    style="stroke"
                    strokeWidth={brushSize}
                    strokeCap="round"
                    strokeJoin="round"
                  />
                )}

                {/* Brush cursor indicator */}
                {cursorPosition && (
                  <Circle
                    cx={cursorPosition.x}
                    cy={cursorPosition.y}
                    r={brushSize / 2}
                    color="rgba(239, 68, 68, 0.3)"
                    style="fill"
                  />
                )}
              </Canvas>
            </View>
          </GestureDetector>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleUndo}
            disabled={paths.length === 0}
          >
            <Text style={[styles.actionButtonText, paths.length === 0 && styles.disabledText]}>
              ↩ Undo
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleClear}
            disabled={paths.length === 0}
          >
            <Text style={[styles.actionButtonText, paths.length === 0 && styles.disabledText]}>
              ✕ Clear
            </Text>
          </TouchableOpacity>
        </View>

        {/* Continue button */}
        <TouchableOpacity
          style={[styles.primaryButton, paths.length === 0 && styles.primaryButtonDisabled]}
          onPress={generateMask}
          disabled={paths.length === 0}
        >
          <Text style={styles.primaryButtonText}>
            {paths.length === 0 ? 'Paint areas to clean' : 'Continue →'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Tip: Paint over clothes, dishes, papers, or any clutter
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
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
  backButton: {
    fontSize: 16,
    color: '#3b82f6',
  },
  content: {
    flex: 1,
    paddingHorizontal: CANVAS_PADDING,
  },
  instruction: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 16,
  },
  brushControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 16,
  },
  brushButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brushButtonText: {
    fontSize: 24,
    color: '#374151',
    fontWeight: '600',
  },
  brushSizeIndicator: {
    alignItems: 'center',
    minWidth: 60,
  },
  brushDot: {
    backgroundColor: 'rgba(239, 68, 68, 0.6)',
    borderRadius: 100,
    marginBottom: 4,
  },
  brushSizeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  canvasContainer: {
    width: CANVAS_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
    position: 'relative',
  },
  backgroundImage: {
    width: '100%',
    position: 'absolute',
  },
  canvas: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  disabledText: {
    color: '#9ca3af',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
  },
});
