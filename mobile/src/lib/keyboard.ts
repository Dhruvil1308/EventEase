import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Keyboard, TextInput, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, type View } from "react-native";

const MARGIN = 24;

/**
 * Android 15+ draws apps edge to edge and no longer shrinks them for the
 * keyboard, so fields near the bottom end up behind it. Put `frame` on the view
 * around the scroll view and a `<View style={{ height: space }} />` after it:
 * the scroll area then ends where the keyboard starts, and the focused field is
 * scrolled up into view.
 */
export function useKeyboardSpace() {
  const frame = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [space, setSpace] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const show = Keyboard.addListener("keyboardDidShow", (e) => {
        const keyboardTop = e.endCoordinates.screenY;
        frame.current?.measureInWindow((_x, y, _w, h) => {
          setSpace(Math.max(0, y + h - keyboardTop));
          // After the scroll area has shrunk, lift the focused field above the keyboard.
          setTimeout(() => {
            TextInput.State.currentlyFocusedInput()?.measureInWindow((_fx, fy, _fw, fh) => {
              const hidden = fy + fh + MARGIN - keyboardTop;
              if (hidden > 0) scroll.current?.scrollTo({ y: offset.current + hidden, animated: true });
            });
          }, 80);
        });
      });
      const hide = Keyboard.addListener("keyboardDidHide", () => setSpace(0));
      return () => {
        show.remove();
        hide.remove();
        setSpace(0);
      };
    }, []),
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  return { frame, scroll, space, onScroll };
}
