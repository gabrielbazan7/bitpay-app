import React from 'react';
import {ActivityIndicator, View} from 'react-native';
import styled from 'styled-components/native';
import {LightBlack, SlateDark, White} from '../../../styles/colors';
import {useAppSelector} from '../../../utils/hooks';
import {BlurContainer} from '../../blur/Blur';
import {BaseText} from '../../styled/Text';
import {HEIGHT, WIDTH} from '../../styled/Containers';
import {useOngoingProcess} from '../../../contexts';
import SheetModal from '../base/sheet/SheetModal';

const Row = styled.View`
  background-color: ${({theme}) => (theme.dark ? LightBlack : White)};
  border-radius: 10px;
  flex-direction: row;
  padding: 20px;
  max-width: 60%;
  padding-right: 47px;
`;

const ActivityIndicatorContainer = styled.View`
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-right: 15px;
`;

const Message = styled(BaseText)`
  font-weight: 700;
  flex-wrap: wrap;
`;

const OnGoingProcessModal: React.FC = () => {
  const {message, isVisible} = useOngoingProcess();
  const appWasInit = useAppSelector(({APP}) => APP.appWasInit);

  return (
    <SheetModal
      id="ongoingProcess"
      isVisible={isVisible && appWasInit}
      fullscreen={true}
      enableBackdropDismiss={false}
      onBackdropPress={() => {}}
      backdropOpacity={0.4}
      backgroundColor="transparent"
      disableAnimations={true}>
      <View
        style={{
          height: HEIGHT,
          width: WIDTH,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Row>
          <ActivityIndicatorContainer>
            <ActivityIndicator color={SlateDark} />
          </ActivityIndicatorContainer>
          <Message>{message}</Message>
          <BlurContainer />
        </Row>
      </View>
    </SheetModal>
  );
};

export default OnGoingProcessModal;
