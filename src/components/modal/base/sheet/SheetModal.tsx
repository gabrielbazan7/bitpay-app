import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, AppStateStatus, Platform, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {useTheme} from 'styled-components/native';
import {ThemeContext as NavigationThemeContext} from '@react-navigation/native';
import {HEIGHT, SheetParams} from '../../../styled/Containers';
import {Black, LightBlack, White} from '../../../../styles/colors';
import {useBottomSheet} from '../../../../contexts/BottomSheetContext';

interface Props extends SheetParams {
  id: string;
  isVisible: boolean;
  fullscreen?: boolean;
  enableBackdropDismiss?: boolean;
  onBackdropPress: (props?: any) => void;
  onModalHide?: () => void;
  children?: any;
  backdropOpacity?: number;
  backgroundColor?: string;
  borderRadius?: number;
  disableAnimations?: boolean;
  height?: number;
  paddingTop?: number;
  snapPoints?: string[];
  stackBehavior?: 'push' | 'replace';
}

type SheetModalProps = React.PropsWithChildren<Props>;

const SheetModal: React.FC<SheetModalProps> = ({
  id,
  children,
  isVisible,
  fullscreen,
  enableBackdropDismiss,
  onBackdropPress,
  onModalHide,
  placement,
  backdropOpacity,
  backgroundColor,
  borderRadius,
  disableAnimations = false,
  height,
  paddingTop,
  snapPoints,
  stackBehavior,
}) => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;
  const theme = useTheme();

  const {requestShow, releaseShow} = useBottomSheet();

  const [isModalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    return () => {
      releaseShow(id);
    };
  }, [id, releaseShow]);

  useEffect(() => {
    function onAppStateChange(status: AppStateStatus) {
      if (isVisible && !fullscreen && status === 'background') {
        setModalVisible(false);
        onBackdropPress();
      }
    }

    const subscriptionAppStateChange = AppState.addEventListener(
      'change',
      onAppStateChange,
    );

    return () => subscriptionAppStateChange.remove();
  }, [isVisible, onBackdropPress]);

  useEffect(() => {
    if (isVisible && !isModalVisible) {
      requestShow(id);
      setModalVisible(true);
      requestAnimationFrame(() => {
        bottomSheetModalRef.current?.present();
      });
    } else if (!isVisible && isModalVisible) {
      releaseShow(id);
      setModalVisible(false);
      bottomSheetModalRef.current?.dismiss();
    }
  }, [isVisible, id, isModalVisible]);

  const defaultBorderRadius = Platform.OS === 'ios' ? 12 : 0;
  const sheetBackgroundColor =
    backgroundColor ?? (theme.dark ? (fullscreen ? Black : LightBlack) : White);
  const bottomSheetViewStyles = {
    backgroundColor: sheetBackgroundColor,
    borderTopLeftRadius: borderRadius ?? defaultBorderRadius,
    borderTopRightRadius: borderRadius ?? defaultBorderRadius,
    paddingBottom: bottomInset,
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        onPress={onBackdropPress}
        pressBehavior={enableBackdropDismiss === false ? 'none' : 'close'}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={backdropOpacity ?? 0.4}
      />
    ),
    [enableBackdropDismiss, onBackdropPress, backdropOpacity],
  );

  const handleDismiss = useCallback(() => {
    releaseShow(id);
    onModalHide?.();
  }, [id, releaseShow, onModalHide]);

  return (
    <View testID={'modalBackdrop'}>
      <BottomSheetModal
        accessible={false}
        stackBehavior={stackBehavior || 'push'}
        backdropComponent={renderBackdrop}
        backgroundStyle={{backgroundColor: sheetBackgroundColor}}
        snapPoints={fullscreen ? ['100%'] : snapPoints || undefined}
        enableDismissOnClose={true}
        enableDynamicSizing={!fullscreen && !snapPoints}
        enableOverDrag={false}
        enablePanDownToClose={false}
        handleComponent={null}
        index={0}
        {...(disableAnimations && {animationConfigs: {duration: 1}})}
        accessibilityLabel={'modalBackdrop'}
        onDismiss={handleDismiss}
        ref={bottomSheetModalRef}>
        <NavigationThemeContext.Provider value={theme as any}>
          <BottomSheetView
            style={
              fullscreen
                ? {
                    ...bottomSheetViewStyles,
                    height: HEIGHT,
                    paddingTop: paddingTop ?? insets.top,
                  }
                : {...bottomSheetViewStyles, height}
            }>
            {children}
          </BottomSheetView>
        </NavigationThemeContext.Provider>
      </BottomSheetModal>
    </View>
  );
};

export default SheetModal;
