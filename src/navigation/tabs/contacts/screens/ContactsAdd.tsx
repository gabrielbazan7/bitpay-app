import React, {
  useState,
  useMemo,
  useCallback,
  useLayoutEffect,
  useEffect,
} from 'react';
import {FlatList, View} from 'react-native';
import {yupResolver} from '@hookform/resolvers/yup';
import yup from '../../../../lib/yup';
import styled, {useTheme} from 'styled-components/native';
import {Controller, useForm} from 'react-hook-form';
import Button from '../../../../components/button/Button';
import BoxInput from '../../../../components/form/BoxInput';
import {
  TextAlign,
  H4,
  BaseText,
  HeaderTitle,
} from '../../../../components/styled/Text';
import {
  SheetContainer,
  Row,
  ActiveOpacity,
  SearchContainer,
  SearchInput,
  RowContainer,
  Column,
} from '../../../../components/styled/Containers';
import {ValidateCoinAddress} from '../../../../store/wallet/utils/validations';
import {GetCoinAndNetwork} from '../../../../store/wallet/effects/address/address';
import {ContactRowProps} from '../../../../components/list/ContactRow';
import {useNavigation} from '@react-navigation/core';
import {RootState} from '../../../../store';
import {
  createContact,
  updateContact,
} from '../../../../store/contact/contact.actions';
import SuccessIcon from '../../../../../assets/img/success.svg';
import SearchSvg from '../../../../../assets/img/search.svg';
import ScanSvg from '../../../../../assets/img/onboarding/scan.svg';
import SheetModal from '../../../../components/modal/base/sheet/SheetModal';
import {
  keyExtractor,
  findContact,
  getBadgeImg,
} from '../../../../utils/helper-methods';
import CurrencySelectionRow, {
  TokenSelectionRow,
} from '../../../../components/list/CurrencySelectionRow';
import NetworkSelectionRow, {
  NetworkSelectionProps,
} from '../../../../components/list/NetworkSelectionRow';
import {LightBlack, NeutralSlate, Slate} from '../../../../styles/colors';
import {CurrencyImage} from '../../../../components/currency-image/CurrencyImage';
import WalletIcons from '../../../wallet/components/WalletIcons';
import {SUPPORTED_ETHEREUM_TOKENS} from '../../../../constants/currencies';
import {BitpaySupportedEthereumTokenOpts} from '../../../../constants/tokens';
import {useAppDispatch, useAppSelector} from '../../../../utils/hooks';
import {TouchableOpacity} from 'react-native-gesture-handler';
import debounce from 'lodash.debounce';
import {useTranslation} from 'react-i18next';
import {logSegmentEvent} from '../../../../store/app/app.effects';
import {ContactsStackParamList} from '../ContactsStack';
import {StackScreenProps} from '@react-navigation/stack';
import {
  SupportedCurrencyOption,
  SupportedEvmCurrencyOptions,
  SupportedTokenOptions,
} from '../../../../constants/SupportedCurrencyOptions';
import Checkbox from '../../../../components/checkbox/Checkbox';

const InputContainer = styled.View<{hideInput?: boolean}>`
  display: ${({hideInput}) => (!hideInput ? 'flex' : 'none')};
  margin: 10px 0;
`;

const ActionContainer = styled.View`
  margin-top: 30px;
`;

const Container = styled.ScrollView`
  flex: 1;
  padding: 0 20px;
  margin-top: 20px;
`;

const AddressBadge = styled.View`
  background: ${({theme}) => (theme && theme.dark ? '#000' : '#fff')};
  position: absolute;
  right: 5px;
  top: 50%;
`;

const ScanButtonContainer = styled.TouchableOpacity`
  position: absolute;
  right: 5px;
  top: 32px;
`;

const CurrencySelectionModalContainer = styled(SheetContainer)`
  padding: 15px;
  min-height: 200px;
`;

const CurrencySelectorContainer = styled.View<{hideSelector?: boolean}>`
  display: ${({hideSelector}) => (!hideSelector ? 'flex' : 'none')};
  margin: 10px 0 20px 0;
  position: relative;
`;

const Label = styled(BaseText)`
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  top: 0;
  left: 1px;
  margin-bottom: 3px;
  color: ${({theme}) => (theme && theme.dark ? theme.colors.text : '#434d5a')};
`;

const CurrencyContainer = styled.TouchableOpacity`
  background: ${({theme}) => (theme.dark ? LightBlack : NeutralSlate)};
  padding: 0 20px 0 10px;
  height: 55px;
  border: 0.75px solid ${({theme}) => (theme.dark ? LightBlack : Slate)};
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
`;

const CurrencyName = styled(BaseText)`
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  margin-left: 10px;
  color: #9ba3ae;
`;

const NetworkName = styled(BaseText)`
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  color: #9ba3ae;
  text-transform: uppercase;
`;

const schema = yup.object().shape({
  name: yup.string().required().trim(),
  email: yup.string().email().trim(),
  destinationTag: yup.number(),
  address: yup.string().required(),
});

const SearchImageContainer = styled.View`
  width: 50px;
  align-items: center;
`;

const IsTokenAddressTitle = styled(BaseText)`
  font-size: 16px;
  color: ${({theme}) => (theme && theme.dark ? theme.colors.text : '#434d5a')};
`;

const CheckBoxContainer = styled.View`
  flex-direction: column;
  justify-content: center;
`;

const ContactsAdd = ({
  route,
}: StackScreenProps<ContactsStackParamList, 'ContactsAdd'>) => {
  const {t} = useTranslation();
  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: {errors, dirtyFields},
  } = useForm<ContactRowProps>({resolver: yupResolver(schema)});
  const {contact, context, onEditComplete} = route.params || {};
  const isDev = __DEV__;

  const theme = useTheme();
  const placeHolderTextColor = theme.dark ? NeutralSlate : '#6F7782';

  const contacts = useAppSelector(({CONTACT}: RootState) => CONTACT.list);
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const [validAddress, setValidAddress] = useState(false);
  const [xrpValidAddress, setXrpValidAddress] = useState(false);
  const [ethValidAddress, setEthValidAddress] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const [addressValue, setAddressValue] = useState('');
  const [coinValue, setCoinValue] = useState('');
  const [chainValue, setChainValue] = useState('');
  const [networkValue, setNetworkValue] = useState('');

  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [chainModalVisible, setChainModalVisible] = useState(false);
  const [networkModalVisible, setNetworkModalVisible] = useState(false);
  const [isTokenAddress, setIsTokenAddress] = useState(false);

  const ethereumTokenOptions = useAppSelector(({WALLET}: RootState) => {
    return {
      ...BitpaySupportedEthereumTokenOpts,
      ...WALLET.tokenOptions,
      ...WALLET.customTokenOptions,
    };
  });

  const ALL_CUSTOM_ETHEREUM_TOKENS = useMemo(
    () =>
      Object.values(ethereumTokenOptions)
        .filter(
          token =>
            !SUPPORTED_ETHEREUM_TOKENS.includes(token.symbol.toLowerCase()),
        )
        .map(({symbol, name, logoURI}) => {
          const chain = 'eth';
          return {
            id: Math.random().toString(),
            coin: symbol.toLowerCase(),
            currencyAbbreviation: symbol,
            currencyName: name,
            img: logoURI || '',
            isToken: true,
            chain,
            badgeUri: getBadgeImg(symbol.toLowerCase(), chain),
          } as SupportedCurrencyOption;
        }),
    [ethereumTokenOptions],
  );

  const ALL_ETHEREUM_TOKENS = useMemo(
    () => [...SupportedTokenOptions, ...ALL_CUSTOM_ETHEREUM_TOKENS],
    [ALL_CUSTOM_ETHEREUM_TOKENS],
  );

  const [ethTokenOptions, setEthTokenOptions] = useState(ALL_ETHEREUM_TOKENS);
  const [chainOptions, setChainOptions] = useState(SupportedEvmCurrencyOptions);

  const [selectedToken, setSelectedToken] = useState(ALL_ETHEREUM_TOKENS[0]);
  const [selectedChain, setSelectedChain] = useState(
    SupportedEvmCurrencyOptions[0],
  );

  const networkOptions = [
    {id: 'livenet', name: 'Livenet'},
    {id: 'testnet', name: 'Testnet'},
  ];

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <HeaderTitle>
          {contact ? t('Edit Contact') : t('New Contact')}
        </HeaderTitle>
      ),
    });
  }, [navigation, t, contact]);

  const onSearchInputChange = useMemo(
    () =>
      debounce((search: string) => {
        let _searchList: Array<any> = [];
        if (search) {
          search = search.toLowerCase();
          _searchList = ethTokenOptions.filter(
            ({currencyAbbreviation, currencyName}) =>
              currencyAbbreviation.toLowerCase().includes(search) ||
              currencyName.toLowerCase().includes(search),
          );
        } else {
          _searchList = ethTokenOptions;
        }
        setEthTokenOptions(_searchList);
      }, 300),
    [ethTokenOptions],
  );

  const setValidValues = (address: string, coin: string, network: string) => {
    setValidAddress(true);
    setAddressValue(address);
    setCoinValue(coin);
    setNetworkValue(network);

    // Selected current coin
    _setSelectedToken(coin);

    switch (coin) {
      case 'eth':
        setEthValidAddress(true);
        return;
      case 'xrp':
        setXrpValidAddress(true);
        return;
      default:
        return;
    }
  };

  const processAddress = (address?: string) => {
    if (address) {
      const coinAndNetwork = GetCoinAndNetwork(address);
      if (coinAndNetwork) {
        const isValid = ValidateCoinAddress(
          address,
          coinAndNetwork.coin,
          coinAndNetwork.network,
        );
        if (isValid) {
          setValidValues(address, coinAndNetwork.coin, coinAndNetwork.network);
        } else {
          // try testnet
          const isValidTest = ValidateCoinAddress(
            address,
            coinAndNetwork.coin,
            'testnet',
          );
          if (isValidTest) {
            setValidValues(address, coinAndNetwork.coin, 'testnet');
          }
        }
      } else {
        setCoinValue('');
        setChainValue('');
        setNetworkValue('');
        setAddressValue('');
        setValidAddress(false);
        setEthValidAddress(false);
        setXrpValidAddress(false);
      }
    }
  };

  const onSubmit = handleSubmit((contact: ContactRowProps) => {
    if (!validAddress) {
      setError('address', {
        type: 'manual',
        message: t('Invalid address'),
      });
      return;
    }

    if (coinValue && networkValue) {
      contact.coin = coinValue;
      contact.network = networkValue;
    } else {
      setError('address', {
        type: 'manual',
        message: t('Coin or Network invalid'),
      });
      return;
    }

    if (coinValue === 'xrp' && !contact.destinationTag) {
      setError('destinationTag', {
        type: 'manual',
        message: t('Tag number is required for XRP address'),
      });
      return;
    }

    if (context === 'edit') {
      dispatch(updateContact(contact));
      navigation.goBack();
      onEditComplete && onEditComplete(contact);
      return;
    }

    if (findContact(contacts, addressValue, coinValue, networkValue)) {
      setError('address', {
        type: 'manual',
        message: t('Contact already exists'),
      });
      return;
    }

    dispatch(createContact(contact));
    navigation.goBack();
  });

  const _setSelectedToken = (id: string) => {
    const _selectedToken = ethTokenOptions.find(token => token.coin === id);
    setSelectedToken(_selectedToken || ethTokenOptions[0]);
  };

  const tokenSelected = (id: string) => {
    _setSelectedToken(id);
    setCoinValue(id);
    setTokenModalVisible(false);
  };

  const networkSelected = ({id}: NetworkSelectionProps) => {
    setNetworkValue(id);
    setNetworkModalVisible(false);
  };

  // Flat list
  const renderItem = useCallback(
    ({item}) => (
      <TokenSelectionRow
        token={item}
        onToggle={tokenSelected}
        key={item.id}
        hideCheckbox={true}
        hideArrow={true}
        badgeUri={item.badgeUri}
      />
    ),
    [],
  );

  const chainSelected = (id: string) => {
    setChainValue(id);
    setChainModalVisible(false);
  };

  const renderItemChain = useCallback(
    ({item}) => (
      <CurrencySelectionRow
        currency={item}
        onToggle={chainSelected}
        key={item.id}
      />
    ),
    [],
  );

  const renderItemNetowrk = useCallback(
    ({item}) => (
      <NetworkSelectionRow item={item} emit={networkSelected} key={item.id} />
    ),
    [],
  );

  const goToScan = () => {
    dispatch(
      logSegmentEvent('track', 'Open Scanner', {
        context: 'contactsAdd',
      }),
    );
    navigation.navigate('Scan', {
      screen: 'Root',
      params: {
        onScanComplete: address => {
          setValue('address', address, {shouldDirty: true});
          processAddress(address);
        },
      },
    });
  };

  useEffect(() => {
    if (contact?.address) {
      setValue('address', contact.address, {shouldDirty: true});
      setValue('name', contact.name || '');
      setValue('email', contact.email);
      setValue('destinationTag', contact.tag || contact.destinationTag);
      if (contact.coin) {
        tokenSelected(contact.coin);
      }
      processAddress(contact.address);
    }
  }, [contact]);

  return (
    <Container keyboardShouldPersistTaps="handled">
      <InputContainer>
        <Controller
          control={control}
          render={({field: {onChange, onBlur, value}}) => (
            <BoxInput
              placeholder={'Satoshi Nakamoto'}
              label={t('NAME')}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.name?.message}
              value={value}
              autoCorrect={false}
            />
          )}
          name="name"
          defaultValue=""
        />
      </InputContainer>
      <InputContainer>
        <Controller
          control={control}
          render={({field: {onChange, onBlur, value}}) => (
            <BoxInput
              placeholder={'satoshi@example.com'}
              label={t('EMAIL (OPTIONAL)')}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.email?.message}
              value={value}
            />
          )}
          name="email"
          defaultValue=""
        />
      </InputContainer>
      {!contact ? (
        <InputContainer>
          <Controller
            control={control}
            render={({field: {onChange, onBlur, value}}) => (
              <BoxInput
                placeholder={'Crypto address'}
                label={t('ADDRESS')}
                onBlur={onBlur}
                onChangeText={(newValue: string) => {
                  onChange(newValue);
                  processAddress(newValue);
                }}
                error={errors.address?.message}
                value={value}
              />
            )}
            name="address"
            defaultValue=""
          />
          {addressValue && dirtyFields.address ? (
            <AddressBadge>
              <SuccessIcon />
            </AddressBadge>
          ) : (
            <ScanButtonContainer onPress={goToScan}>
              <ScanSvg />
            </ScanButtonContainer>
          )}
        </InputContainer>
      ) : (
        <InputContainer>
          <Controller
            control={control}
            render={({field: {value}}) => (
              <BoxInput disabled={true} label={t('ADDRESS')} value={value} />
            )}
            name="address"
            defaultValue=""
          />
        </InputContainer>
      )}

      {!contact && ethValidAddress ? (
        <RowContainer
          onPress={() => {
            setIsTokenAddress(!isTokenAddress);
          }}>
          <Column>
            <IsTokenAddressTitle>{t('Is Token Address?')}</IsTokenAddressTitle>
          </Column>
          <CheckBoxContainer>
            <Checkbox
              checked={isTokenAddress}
              onPress={() => {
                setIsTokenAddress(!isTokenAddress);
              }}
            />
          </CheckBoxContainer>
        </RowContainer>
      ) : null}

      <InputContainer hideInput={!xrpValidAddress}>
        <Controller
          control={control}
          render={({field: {onChange, onBlur, value}}) => (
            <BoxInput
              placeholder={'Tag'}
              label={t('TAG')}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.destinationTag?.message}
              keyboardType={'number-pad'}
              type={'number'}
              maxLength={9}
              value={value?.toString()}
            />
          )}
          name="destinationTag"
        />
      </InputContainer>

      {!contact && isTokenAddress ? (
        <CurrencySelectorContainer hideSelector={!ethValidAddress}>
          <Label>{t('CHAIN')}</Label>
          <CurrencyContainer
            activeOpacity={ActiveOpacity}
            onPress={() => {
              setChainModalVisible(true);
            }}>
            <Row
              style={{
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <Row style={{alignItems: 'center'}}>
                {selectedChain ? (
                  <View>
                    <CurrencyImage img={selectedChain.img} size={30} />
                  </View>
                ) : null}
                <CurrencyName>
                  {selectedChain?.currencyAbbreviation}
                </CurrencyName>
              </Row>
              <WalletIcons.DownToggle />
            </Row>
          </CurrencyContainer>
        </CurrencySelectorContainer>
      ) : null}

      {!contact ? (
        <CurrencySelectorContainer hideSelector={!ethValidAddress}>
          <Label>{t('TOKEN')}</Label>
          <CurrencyContainer
            activeOpacity={ActiveOpacity}
            onPress={() => {
              setTokenModalVisible(true);
            }}>
            <Row
              style={{
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <Row style={{alignItems: 'center'}}>
                {selectedToken ? (
                  <View>
                    <CurrencyImage
                      img={selectedToken.img}
                      size={30}
                      badgeUri={selectedToken?.badgeUri}
                    />
                  </View>
                ) : null}
                <CurrencyName>
                  {selectedToken?.currencyAbbreviation}
                </CurrencyName>
              </Row>
              <WalletIcons.DownToggle />
            </Row>
          </CurrencyContainer>
        </CurrencySelectorContainer>
      ) : null}

      <CurrencySelectorContainer
        hideSelector={!isDev || !(xrpValidAddress || ethValidAddress)}>
        <Label>{t('NETWORK')}</Label>
        <CurrencyContainer
          activeOpacity={ActiveOpacity}
          onPress={() => {
            setNetworkModalVisible(true);
          }}>
          <Row
            style={{
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <Row style={{alignItems: 'center'}}>
              <NetworkName>{networkValue}</NetworkName>
            </Row>
            <WalletIcons.DownToggle />
          </Row>
        </CurrencyContainer>
      </CurrencySelectorContainer>

      <ActionContainer>
        <Button onPress={onSubmit}>
          {contact ? t('Save Contact') : t('Add Contact')}
        </Button>
      </ActionContainer>
      <SheetModal
        isVisible={chainModalVisible}
        onBackdropPress={() => setChainModalVisible(false)}>
        <CurrencySelectionModalContainer>
          <TextAlign align={'center'} style={{paddingBottom: 20}}>
            <H4>{t('Select a Chain')}</H4>
          </TextAlign>
          <FlatList
            contentContainerStyle={{minHeight: '100%'}}
            data={chainOptions}
            keyExtractor={keyExtractor}
            renderItem={renderItemChain}
          />
        </CurrencySelectionModalContainer>
      </SheetModal>
      <SheetModal
        isVisible={tokenModalVisible}
        onBackdropPress={() => setTokenModalVisible(false)}>
        <CurrencySelectionModalContainer>
          <TextAlign align={'center'} style={{paddingBottom: 20}}>
            <H4>{t('Select a Token')}</H4>
          </TextAlign>
          <SearchContainer>
            <SearchInput
              placeholder={t('Search Token')}
              placeholderTextColor={placeHolderTextColor}
              value={searchInput}
              onChangeText={(text: string) => {
                setSearchInput(text);
                onSearchInputChange(text);
              }}
            />
            <SearchImageContainer>
              {!searchInput ? (
                <SearchSvg />
              ) : (
                <TouchableOpacity
                  activeOpacity={ActiveOpacity}
                  onPress={() => {
                    setSearchInput('');
                    onSearchInputChange('');
                  }}>
                  <WalletIcons.Delete />
                </TouchableOpacity>
              )}
            </SearchImageContainer>
          </SearchContainer>
          <FlatList
            contentContainerStyle={{minHeight: '100%'}}
            data={ethTokenOptions}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
          />
        </CurrencySelectionModalContainer>
      </SheetModal>
      <SheetModal
        isVisible={networkModalVisible}
        onBackdropPress={() => setNetworkModalVisible(false)}>
        <CurrencySelectionModalContainer>
          <TextAlign align={'center'}>
            <H4>{t('Select a Network')}</H4>
          </TextAlign>
          <FlatList
            contentContainerStyle={{paddingTop: 20, paddingBottom: 20}}
            data={networkOptions}
            keyExtractor={keyExtractor}
            renderItem={renderItemNetowrk}
          />
        </CurrencySelectionModalContainer>
      </SheetModal>
    </Container>
  );
};

export default ContactsAdd;
