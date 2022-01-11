import React, {ReactChild} from 'react';
import BottomPopupModal from '../base/bottom-popup/BottomPopupModal';
import {BaseText, H4} from '../../styled/Text';
import styled, {css} from 'styled-components/native';
import {useDispatch, useSelector} from 'react-redux';
import {AppActions} from '../../../store/app';
import {RootState} from '../../../store';
import {NotificationPrimary} from '../../../styles/colors';
import haptic from '../../haptic-feedback/haptic';
import {Platform} from 'react-native';
import SuccessSvg from '../../../../assets/img/success.svg';
import InfoSvg from '../../../../assets/img/info.svg';
import WarningSvg from '../../../../assets/img/warning.svg';
import ErrorSvg from '../../../../assets/img/error.svg';
import {sleep} from '../../../utils/helper-methods';

export interface BottomNotificationConfig {
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  actions: Array<{
    text: string;
    primary?: boolean;
    action: (rootState: RootState) => any;
  }>;
  list?: ReactChild;
  enableBackdropDismiss: boolean;
}

const svgProps = {
  width: 25,
  height: 25,
};

const notificationType = {
  success: () => <SuccessSvg {...svgProps} />,
  info: () => <InfoSvg {...svgProps} />,
  warning: () => <WarningSvg {...svgProps} />,
  error: () => <ErrorSvg {...svgProps} />,
};

const BottomNotificationContainer = styled.View`
  background: white;
  padding: 25px;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
`;

const Row = styled.View`
  flex-direction: row;
  align-items: center;
`;

const ImageContainer = styled.View`
  margin-right: 10px;
`;

const MessageContainer = styled.View`
  margin: 15px 0 20px 0;
`;

const Message = styled(BaseText)`
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: 24px;
  letter-spacing: 0.5px;
  text-align: left;
`;

const Hr = styled.View`
  border-bottom-color: #ebebeb;
  border-bottom-width: 1px;
  margin: 20px 0;
`;

const CtaContainer = styled.View`
  flex-direction: row;
  justify-content: space-between;
  ${({platform}: {platform: string}) =>
    platform === 'ios' &&
    css`
      margin-bottom: 10px;
    `}
`;

const Cta = styled.Text`
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: 24px;
  letter-spacing: 0.5px;
  text-align: left;
  color: ${(props: {primary?: boolean}) =>
    props.primary ? NotificationPrimary : 'black'};
`;

const BottomNotification = () => {
  const dispatch = useDispatch();
  const rootState = useSelector((state: RootState) => state);
  const isVisible = useSelector(
    ({APP}: RootState) => APP.showBottomNotificationModal,
  );
  const config = useSelector(
    ({APP}: RootState) => APP.bottomNotificationModalConfig,
  );

  const {type, title, message, actions, enableBackdropDismiss, list} =
    config || {};

  return (
    <BottomPopupModal
      isVisible={isVisible}
      onBackdropPress={() => {
        if (enableBackdropDismiss) {
          dispatch(AppActions.dismissBottomNotificationModal());
          haptic('impactLight');
        }
      }}>
      <BottomNotificationContainer>
        <Row>
          <ImageContainer>{notificationType[type || 'info']()}</ImageContainer>
          <H4>{title}</H4>
        </Row>
        <MessageContainer>
          <Message>{message}</Message>
        </MessageContainer>
        {list ? list : null}
        <Hr />
        <CtaContainer platform={Platform.OS}>
          {actions?.map(({primary, action, text}, index) => {
            return (
              <Cta
                key={index}
                suppressHighlighting={true}
                primary={primary}
                onPress={async () => {
                  haptic('impactLight');
                  dispatch(AppActions.dismissBottomNotificationModal());
                  await sleep(0);
                  action(rootState);
                }}>
                {text.toUpperCase()}
              </Cta>
            );
          })}
        </CtaContainer>
      </BottomNotificationContainer>
    </BottomPopupModal>
  );
};

export default BottomNotification;
