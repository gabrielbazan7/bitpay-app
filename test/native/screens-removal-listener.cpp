#include "RNSScreenRemovalListener.h"
#include <cstdio>
#include <vector>

namespace {
std::vector<int> notified;

ShadowViewMutation
mutation(ShadowViewMutation::Type type, const char *componentName, Tag tag) {
  ShadowViewMutation result;
  result.type = type;
  result.parentTag = 1;
  if (type == ShadowViewMutation::Type::Insert) {
    result.newChildShadowView = {componentName, tag};
  } else {
    result.oldChildShadowView = {componentName, tag};
  }
  return result;
}

std::vector<int> pull(
    const RNSScreenRemovalListener &listener,
    ShadowViewMutationList mutations) {
  notified.clear();
  listener.pullTransaction(1, 1, TransactionTelemetry{}, std::move(mutations));
  return notified;
}
} // namespace

int main() {
  using Type = ShadowViewMutation::Type;
  RNSScreenRemovalListener listener([](int tag) { notified.push_back(tag); });

  if (pull(
          listener,
          {mutation(Type::Remove, "RNSScreen", 10),
           mutation(Type::Insert, "RNSScreen", 10)}) != std::vector<int>{}) {
    return 1;
  }
  if (pull(
          listener,
          {mutation(Type::Remove, "RNSScreen", 10),
           mutation(Type::Delete, "RNSScreen", 10)}) !=
      std::vector<int>{10}) {
    return 2;
  }
  if (pull(
          listener,
          {mutation(Type::Remove, "RNSScreen", 10),
           mutation(Type::Remove, "RNSScreen", 12),
           mutation(Type::Insert, "RNSScreen", 14)}) !=
      std::vector<int>{10, 12}) {
    return 3;
  }
  if (pull(
          listener,
          {mutation(Type::Insert, "RNSScreen", 10),
           mutation(Type::Remove, "RNSScreen", 10)}) !=
      std::vector<int>{10}) {
    return 4;
  }
  if (pull(listener, {mutation(Type::Remove, "RCTView", 10)}) !=
      std::vector<int>{}) {
    return 5;
  }
  std::puts("screen removal listener cases passed");
}
