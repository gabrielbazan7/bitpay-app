import React, {ReactElement, memo} from 'react';
import {BaseText, ListItemSubText} from '../styled/Text';
import styled from 'styled-components/native';
import {ScreenGutter} from '../styled/Containers';
import {useTranslation} from 'react-i18next';
export const TRANSACTION_PROPOSAL_ROW_HEIGHT = 75;

const TransactionContainer = styled.TouchableOpacity`
  flex-direction: row;
  padding-left: ${ScreenGutter};
  padding-right: ${ScreenGutter};
  justify-content: center;
  align-items: center;
  height: ${TRANSACTION_PROPOSAL_ROW_HEIGHT}px;
`;

const IconContainer = styled.View`
  margin-right: 8px;
`;

const Description = styled(BaseText)`
  overflow: hidden;
  margin-right: 175px;
  font-size: 16px;
`;

const Creator = styled(ListItemSubText)`
  overflow: hidden;
  margin-right: 175px;
`;

const TailContainer = styled.View`
  margin-left: auto;
`;

const HeadContainer = styled.View``;

const Value = styled(BaseText)`
  text-align: right;
  font-weight: 700;
  font-size: 16px;
`;

interface Props {
  icon?: ReactElement;
  creator?: string;
  value?: string;
  time?: string;
  message?: string;
  onPressTransaction?: () => void;
  hideIcon?: boolean;
}

const TransactionProposalRow = ({
  icon,
  creator,
  value,
  time,
  message,
  onPressTransaction,
  hideIcon,
}: Props) => {
  const {t} = useTranslation();
  return (
    <TransactionContainer onPress={onPressTransaction}>
      {icon && !hideIcon && <IconContainer>{icon}</IconContainer>}

      <HeadContainer>
        <Description numberOfLines={message ? 2 : 1} ellipsizeMode={'tail'}>
          {message ? message : t('Sending')}
        </Description>
        {creator && (
          <Creator numberOfLines={1} ellipsizeMode={'tail'}>
            {t('Created by ', {creator})}
          </Creator>
        )}
      </HeadContainer>

      <TailContainer>
        {value && <Value>{value}</Value>}
        {time && <ListItemSubText textAlign={'right'}>{time}</ListItemSubText>}
      </TailContainer>
    </TransactionContainer>
  );
};

export default memo(TransactionProposalRow);
