import MetabaseSettings from "metabase/lib/settings";
import Question from "metabase-lib/lib/Question";
import { ExpressionDimension } from "metabase-lib/lib/Dimension";

import type Metadata from "metabase-lib/lib/metadata/Metadata";
import type { Card } from "metabase-types/types/Card";
import type {
  ParameterOption,
  Parameter,
  ParameterMappingUIOption,
} from "metabase-types/types/Parameter";

import {
  dimensionFilterForParameter,
  variableFilterForParameter,
  getParameterOptions,
  PARAMETER_OPERATOR_TYPES,
  getOperatorDisplayName,
} from "metabase/meta/Parameter";

import { t } from "ttag";
import _ from "underscore";

import { slugify } from "metabase/lib/formatting";

export type ParameterSection = {
  id: string,
  name: string,
  description: string,
  options: ParameterOption[],
};

const areFieldFilterOperatorsEnabled = () =>
  MetabaseSettings.get("field-filter-operators-enabled?");

export function getParameterSections(): ParameterSection[] {
  const parameterOptions = getParameterOptions();
  const LOCATION_OPTIONS = areFieldFilterOperatorsEnabled()
    ? PARAMETER_OPERATOR_TYPES["string"].map(option => {
        return {
          ...option,
          sectionId: "location",
          combinedName: getOperatorDisplayName(option, "string", t`Location`),
        };
      })
    : parameterOptions.filter(option => option.type.startsWith("location"));

  const CATEGORY_OPTIONS = areFieldFilterOperatorsEnabled()
    ? PARAMETER_OPERATOR_TYPES["string"].map(option => {
        return {
          ...option,
          sectionId: "category",
          combinedName: getOperatorDisplayName(option, "string", t`Category`),
        };
      })
    : parameterOptions.filter(option => option.type.startsWith("category"));

  return [
    {
      id: "date",
      name: t`Time`,
      description: t`Date range, relative date, time of day, etc.`,
      options: PARAMETER_OPERATOR_TYPES["date"].map(option => {
        return {
          ...option,
          sectionId: "date",
          combinedName: getOperatorDisplayName(option, "date", t`Date`),
        };
      }),
    },
    {
      id: "location",
      name: t`Location`,
      description: t`City, State, Country, ZIP code.`,
      options: LOCATION_OPTIONS,
    },
    {
      id: "id",
      name: t`ID`,
      description: t`User ID, product ID, event ID, etc.`,
      options: [
        {
          ..._.findWhere(parameterOptions, { type: "id" }),
          sectionId: "id",
        },
      ],
    },
    areFieldFilterOperatorsEnabled() && {
      id: "number",
      name: t`Number`,
      description: t`Subtotal, Age, Price, Quantity, etc.`,
      options: PARAMETER_OPERATOR_TYPES["number"].map(option => {
        return {
          ...option,
          sectionId: "number",
          combinedName: getOperatorDisplayName(option, "number", t`Number`),
        };
      }),
    },
    {
      id: "category",
      name: t`Other Categories`,
      description: t`Category, Type, Model, Rating, etc.`,
      options: CATEGORY_OPTIONS,
    },
  ].filter(Boolean);
}

export function getParameterMappingOptions(
  metadata: Metadata,
  parameter: ?Parameter = null,
  card: Card,
): ParameterMappingUIOption[] {
  const options = [];
  if (card.display === "text") {
    // text cards don't have parameters
    return [];
  }

  const question = new Question(card, metadata);
  const query = question.query();

  if (question.isStructured()) {
    options.push(
      ...query
        .dimensionOptions(
          parameter ? dimensionFilterForParameter(parameter) : undefined,
        )
        .sections()
        .flatMap(section =>
          section.items.map(({ dimension }) => ({
            sectionName: section.name,
            name: dimension.displayName(),
            icon: dimension.icon(),
            target: ["dimension", dimension.mbql()],
            // these methods don't exist on instances of ExpressionDimension
            isForeign: !!(dimension instanceof ExpressionDimension
              ? false
              : dimension.fk() || dimension.joinAlias()),
          })),
        ),
    );
  } else {
    options.push(
      ...query
        .variables(
          parameter ? variableFilterForParameter(parameter) : undefined,
        )
        .map(variable => ({
          name: variable.displayName(),
          icon: variable.icon(),
          isForeign: false,
          target: ["variable", variable.mbql()],
        })),
    );
    options.push(
      ...query
        .dimensionOptions(
          parameter ? dimensionFilterForParameter(parameter) : undefined,
        )
        .sections()
        .flatMap(section =>
          section.items.map(({ dimension }) => ({
            name: dimension.displayName(),
            icon: dimension.icon(),
            isForeign: false,
            target: ["dimension", dimension.mbql()],
          })),
        ),
    );
  }

  return options;
}

export function createParameter(
  option: ParameterOption,
  parameters: Parameter[] = [],
): Parameter {
  let name = option.combinedName || option.name;
  let nameIndex = 0;
  // get a unique name
  while (_.any(parameters, p => p.name === name)) {
    name = (option.combinedName || option.name) + " " + ++nameIndex;
  }

  const parameter = {
    name: "",
    slug: "",
    id: Math.floor(Math.random() * Math.pow(2, 32)).toString(16),
    type: option.type,
    sectionId: option.sectionId,
  };
  return setParameterName(parameter, name);
}

export function setParameterName(
  parameter: Parameter,
  name: string,
): Parameter {
  if (!name) {
    name = "unnamed";
  }
  const slug = slugify(name);
  return {
    ...parameter,
    name: name,
    slug: slug,
  };
}

export function setParameterDefaultValue(
  parameter: Parameter,
  value: string,
): Parameter {
  return {
    ...parameter,
    default: value,
  };
}
