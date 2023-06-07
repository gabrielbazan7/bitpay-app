import {StackScreenProps} from '@react-navigation/stack';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {SafeAreaView} from 'react-native';
import {HeaderTitle} from '../../../components/styled/Text';
import {selectCardGroups} from '../../../store/card/card.selectors';
import {useAppSelector} from '../../../utils/hooks';
import CardDashboard from '../components/CardDashboard';
import CardIntro from '../components/CardIntro';
import {TabsScreens, TabsStackParamList} from '../../tabs/TabsStack';

export type CardHomeScreenParamList =
  | {
      id: string | undefined | null;
    }
  | undefined;

export type CardHomeScreenProps = StackScreenProps<
  TabsStackParamList,
  TabsScreens.CARD
>;

const CardHome: React.FC<CardHomeScreenProps> = ({navigation, route}) => {
  const cardGroups = useAppSelector(selectCardGroups);
  const hasCards = cardGroups.length > 0;
  const {t} = useTranslation();

  useEffect(() => {
    navigation.setOptions({
      headerShown: hasCards,
      headerTitle: () => <HeaderTitle>{t('Card')}</HeaderTitle>
    });
  }, [hasCards, navigation, t]);

  if (hasCards) {
    const id = route.params?.id || cardGroups[0][0].id;

    return (
      <SafeAreaView>
        <CardDashboard id={id} navigation={navigation} route={route} />
      </SafeAreaView>
    );
  }

  return <CardIntro navigation={navigation} />;
};

export default CardHome;
