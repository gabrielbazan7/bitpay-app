#pragma once
#include <cstring>
#include <functional>
#include <optional>
#include <utility>
#include <vector>

namespace facebook::react {
using Tag = int;
using SurfaceId = int;

struct ShadowView {
  const char *componentName = nullptr;
  Tag tag = 0;
};

struct ShadowViewMutation {
  enum class Type { Create, Delete, Insert, Remove, Update };
  Type type = Type::Create;
  Tag parentTag = 0;
  ShadowView oldChildShadowView;
  ShadowView newChildShadowView;
};

using ShadowViewMutationList = std::vector<ShadowViewMutation>;

struct TransactionTelemetry {};

struct MountingTransaction {
  using Number = long long;
  MountingTransaction(
      SurfaceId,
      Number,
      ShadowViewMutationList &&list,
      TransactionTelemetry)
      : mutations(std::move(list)) {}
  ShadowViewMutationList mutations;
};

struct MountingOverrideDelegate {
  virtual ~MountingOverrideDelegate() = default;
  virtual bool shouldOverridePullTransaction() const = 0;
  virtual std::optional<MountingTransaction> pullTransaction(
      SurfaceId,
      MountingTransaction::Number,
      const TransactionTelemetry &,
      ShadowViewMutationList) const = 0;
};
} // namespace facebook::react
