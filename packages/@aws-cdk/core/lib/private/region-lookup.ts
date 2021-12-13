import * as cxapi from '@aws-cdk/cx-api';
import { RegionInfo } from '@aws-cdk/region-info';
import { CfnMapping } from '../cfn-mapping';
import { Aws } from '../cfn-pseudo';
import { Stack } from '../stack';

/**
 * Make sure a CfnMapping exists in the given stack with the lookup values for the given fact
 *
 * Add to an existing CfnMapping if possible.
 */
export function deployTimeLookup(stack: Stack, factName: string, lookupMap: Record<string, string>, defaultValue?: string) {
  // If there are no lookups, just return the default
  if (Object.values(lookupMap).length === 0) {
    if (defaultValue === undefined) {
      throw new Error(`region-info: don't have any information for ${factName}. Use 'Fact.register' to provide values, or add partitions to the '${cxapi.TARGET_PARTITIONS}' context value.`);
    }
    return defaultValue;
  }

  // If the tokenized representation of all values is the same, we can just
  // return the value directly and don't need to produce an actual map.
  const tokenizedValues = Object.values(tokenizedMap(lookupMap));
  if (tokenizedValues.every((v) => v === tokenizedValues[0])) {
    return tokenizedValues[0];
  }

  // Derive map name and lookup key from the factName, splitting on ':' if it exists
  const [factClass, factParam] = factName.includes(':')
    ? factName.split(':')
    : [factName, 'value'] as const;

  const mapId = `${ucfirst(factClass)}Map`;
  const factKey = factParam.replace(/[^a-zA-Z0-9]/g, '_');

  let mapping = stack.node.tryFindChild(mapId) as CfnMapping | undefined;
  if (!mapping) {
    mapping = new CfnMapping(stack, mapId);
  }
  for (const [region, value] of Object.entries(lookupMap)) {
    mapping.setValue(region, factKey, value);
  }
  return mapping.findInMap(Aws.REGION, factKey);
}

function ucfirst(x: string) {
  return `${x.substr(0, 1).toUpperCase()}${x.substr(1)}`;
}

/**
 * Try to detect if all values in the map follow the same pattern
 *
 * Do this by replacing region and URLSuffix values in the found strings
 * with their token variant. If at the end all strings have the same format,
 * we can simplify to just the single value.
 *
 * This wouldn't have been necessary if the region-info library had encoded the
 * pattern information instead of the literal values... but let's do it here now.
 */
function tokenizedMap(regionMap: Record<string, string>): Record<string, string> {
  const ret: Record<string, string> = {};
  for (const [region, value] of Object.entries(regionMap)) {
    let tokenizedValue = value;

    const info = RegionInfo.get(region);
    if (info?.domainSuffix) {
      tokenizedValue = replaceAll(tokenizedValue, info.domainSuffix, Aws.URL_SUFFIX);
    }
    tokenizedValue = replaceAll(tokenizedValue, region, Aws.REGION);

    ret[region] = tokenizedValue;
  }
  return ret;
}

function replaceAll(x: string, pat: string, replacement: string) {
  return x.split(pat).join(replacement);
}
