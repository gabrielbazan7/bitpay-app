import React, {useLayoutEffect} from 'react';
import {ScrollView, TouchableOpacity} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import styled from 'styled-components/native';
import {MerchantScreens, MerchantGroupParamList} from '../MerchantGroup';
import MerchantItem from './../../components/MerchantItem';
import {horizontalPadding} from './../../components/styled/ShopTabComponents';
import {ActiveOpacity} from '../../../../../components/styled/Containers';

const SearchResults = styled.View`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  padding: ${horizontalPadding}px;
`;

const MerchantCategory = ({
  route,
  navigation,
}: NativeStackScreenProps<MerchantGroupParamList, 'MerchantCategory'>) => {
  const navigator = useNavigation();
  const {integrations, category} = route.params;
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: category.displayName,
    });
  });

  return (
    <ScrollView>
      <SearchResults>
        {integrations.map(integration => (
          <TouchableOpacity
            activeOpacity={ActiveOpacity}
            key={integration.displayName}
            onPress={() =>
              navigator.navigate(MerchantScreens.MERCHANT_DETAILS, {
                directIntegration: integration,
              })
            }>
            <MerchantItem
              merchant={integration}
              height={200}
              key={integration.displayName}
            />
          </TouchableOpacity>
        ))}
      </SearchResults>
    </ScrollView>
  );
};

export default MerchantCategory;
