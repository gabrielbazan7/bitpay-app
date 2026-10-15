import React from 'react';
import {StackActions} from '@react-navigation/native';
import {render} from '@test/render';
import Contacts from './Contacts';

const mockParentDispatch = jest.fn();
let mockContacts: unknown[] = [];

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (effect: () => void) => {
    const {useEffect} = require('react');
    useEffect(effect, [effect]);
  },
}));

jest.mock('../SettingsRoot', () => ({
  SettingsComponent: ({children}: {children: React.ReactNode}) => {
    const {View} = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('../../../../components/list/ContactRow', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../../utils/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({CONTACT: {list: mockContacts}}),
}));

const renderScreen = () =>
  render(
    <Contacts
      navigation={
        {
          navigate: jest.fn(),
          getParent: () => ({dispatch: mockParentDispatch}),
        } as any
      }
      route={{} as any}
    />,
  );

describe('Settings Contacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens Add Contact instead of an empty section', () => {
    mockContacts = [];

    const {toJSON} = renderScreen();

    expect(mockParentDispatch).toHaveBeenCalledWith(
      StackActions.replace('ContactsAdd'),
    );
    expect(toJSON()).toBeNull();
  });

  it('stays on the section when there are contacts', () => {
    mockContacts = [{name: 'Alice'}];

    renderScreen();

    expect(mockParentDispatch).not.toHaveBeenCalled();
  });
});
