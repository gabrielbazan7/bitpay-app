import React, {memo} from 'react';
import {
  CurrencyColumn,
  CurrencyImageContainer,
  ActiveOpacity,
} from '../styled/Containers';
import {RowContainer} from '../styled/Containers';
import {H5, H7} from '../styled/Text';
import {CurrencyImage} from '../currency-image/CurrencyImage';
import {GlobalSelectObj} from '../../navigation/wallet/screens/GlobalSelect';
import styled from 'styled-components/native';
import {LightBlack, NeutralSlate} from '../../styles/colors';
import AngleRightSvg from '../../../assets/img/angle-right.svg';
import {useTranslation} from 'react-i18next';
import EthIcon from '../../../assets/img/currencies/eth.svg';
import {IsERCToken} from '../../store/wallet/utils/currency';

interface Props {
  item: GlobalSelectObj;
  emit: (item: GlobalSelectObj) => void;
}

export const AvailableWalletsPill = styled.View`
  background-color: ${({theme: {dark}}) => (dark ? LightBlack : NeutralSlate)};
  flex-direction: row;
  border-radius: 40px;
  align-items: center;
  justify-content: center;
  padding: 10px;
  margin-right: 10px;
`;
export const ChainImageContainer = styled.View`
  position: absolute;
  right: 5px;
  bottom: 0px;
`;

const GlobalSelectRow = ({item, emit}: Props) => {
  const {t} = useTranslation();
  const {currencyName, currencyAbbreviation, total, img, chain} = item;

  return (
    <RowContainer activeOpacity={ActiveOpacity} onPress={() => emit(item)}>
      <CurrencyImageContainer>
        <CurrencyImage img={img} />
        <ChainImageContainer>
          {chain === 'eth' && IsERCToken(currencyAbbreviation) && (
            <EthIcon width={25} height={25} />
          )}
        </ChainImageContainer>
      </CurrencyImageContainer>
      <CurrencyColumn>
        <H5>{currencyName}</H5>
      </CurrencyColumn>
      {total > 1 && (
        <AvailableWalletsPill>
          <H7 medium={true}>
            {total} {t('Wallets')}
          </H7>
        </AvailableWalletsPill>
      )}

      <AngleRightSvg />
    </RowContainer>
  );
};

export default memo(GlobalSelectRow);
