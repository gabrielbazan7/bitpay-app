import React from 'react';
import {act, fireEvent, render} from '@test/render';
import TransactMenu from './TransactMenu';

const mockNavigate = jest.fn();
const mockPreload = jest.fn();
const mockDispatch = jest.fn();
const mockUseAppSelector = jest.fn();
const mockSheetModal = jest.fn(({children}) => children);
const mockFlashList = jest.fn((_props: unknown) => null);
const mockBottomSheetScrollable = jest.fn((_props: unknown) => null);
const mockUseBottomSheetScrollableCreator = jest.fn(
  () => mockBottomSheetScrollable,
);

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: mockNavigate, preload: mockPreload}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (value: string) => value}),
}));

jest.mock('../../../utils/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: unknown) => unknown) =>
    mockUseAppSelector(selector),
}));

jest.mock('../base/sheet/SheetModal', () => ({
  __esModule: true,
  default: (props: {children?: React.ReactNode}) => mockSheetModal(props),
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  useBottomSheetScrollableCreator: () => mockUseBottomSheetScrollableCreator(),
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: (props: unknown) => mockFlashList(props),
}));

const state = {
  APP: {showArchaxBanner: false},
  LOCATION: {locationData: undefined},
  WALLET: {keys: {}},
};

// Menu items are disabled without a funded wallet, so press-path tests need one.
const fundedState = {
  ...state,
  WALLET: {
    keys: {
      key1: {
        backupComplete: true,
        wallets: [
          {
            hideWallet: false,
            hideWalletByAccount: false,
            pendingTssSession: false,
            isComplete: () => true,
            balance: {sat: 1000},
          },
        ],
      },
    },
  },
};

describe('TransactMenu lazy content', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppSelector.mockImplementation(selector => selector(state));
  });

  it('does not mount selectors, list, or sheet until the first tap', () => {
    const {getByTestId} = render(<TransactMenu />);

    expect(mockUseAppSelector).not.toHaveBeenCalled();
    expect(mockSheetModal).not.toHaveBeenCalled();
    expect(mockUseBottomSheetScrollableCreator).not.toHaveBeenCalled();
    expect(mockFlashList).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('transact-menu-button'));

    expect(mockUseAppSelector).toHaveBeenCalledTimes(3);
    expect(mockSheetModal).toHaveBeenCalled();
    expect(mockSheetModal.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({isVisible: true}),
    );
    expect(mockUseBottomSheetScrollableCreator).toHaveBeenCalled();
    expect(mockFlashList).toHaveBeenCalledWith(
      expect.objectContaining({
        renderScrollComponent: mockBottomSheetScrollable,
      }),
    );
  });

  it('keeps the sheet mounted with isVisible false while it closes', () => {
    const {getByTestId, queryByTestId} = render(<TransactMenu />);
    fireEvent.press(getByTestId('transact-menu-button'));

    act(() => {
      mockSheetModal.mock.lastCall?.[0].onBackdropPress();
    });

    expect(mockSheetModal.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({isVisible: false}),
    );
    expect(queryByTestId('transact-menu-content')).toBeTruthy();

    act(() => {
      mockSheetModal.mock.lastCall?.[0].onModalHide();
    });

    expect(queryByTestId('transact-menu-content')).toBeNull();
  });

  it('defers navigation until the sheet has finished dismissing', () => {
    const {getByTestId} = render(<TransactMenu />);
    fireEvent.press(getByTestId('transact-menu-button'));

    fireEvent.press(getByTestId('transact-menu-scan'));

    // The tap must not navigate while the sheet is still animating out.
    expect(mockNavigate).not.toHaveBeenCalled();

    act(() => {
      mockSheetModal.mock.lastCall?.[0].onModalHide();
    });

    expect(mockNavigate).toHaveBeenCalledWith('ScanRoot');
  });

  it('cancels a queued tap when the sheet is reopened mid-dismiss', () => {
    const {getByTestId} = render(<TransactMenu />);
    fireEvent.press(getByTestId('transact-menu-button'));
    fireEvent.press(getByTestId('transact-menu-scan'));

    // Reopening before the dismiss lands means the user changed their mind.
    fireEvent.press(getByTestId('transact-menu-button'));

    act(() => {
      mockSheetModal.mock.lastCall?.[0].onModalHide();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('preloads the destination on press so it mounts during the dismiss', () => {
    mockUseAppSelector.mockImplementation(selector => selector(fundedState));
    const {getByTestId} = render(<TransactMenu />);
    fireEvent.press(getByTestId('transact-menu-button'));

    const {data, renderItem} = mockFlashList.mock.lastCall?.[0] as any;
    const buyCrypto = data.find((item: any) => item.id === 'buyCrypto');

    const {getByTestId: getItem} = render(renderItem({item: buyCrypto}));
    fireEvent.press(getItem('transact-menu-item-buyCrypto'));

    expect(mockPreload).toHaveBeenCalledWith('BuyAndSellRoot', {
      context: 'buyCrypto',
    });
  });
});
