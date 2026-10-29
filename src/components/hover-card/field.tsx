import { For, Show } from "solid-js";

import {
  absoluteRef,
  type FieldSchema,
  type FieldStep,
  fieldSchemaAt,
} from "../../lib/field-schema";
import { LexiconPropertyView } from "../lexicon-schema";
import HoverCard, { type HoverTriggerRenderer } from "./base";
import { createHoverResource } from "./resource";

/** A field of a record and what its lexicon says about it, shown when hovering the field's key. */
const FieldHoverCard = (props: {
  collection: string;
  steps: FieldStep[];
  /** The field's name; an array item is shown as "item". */
  name: string;
  /** The `$type` of the field's value, which picks its type from a union. */
  valueType?: string;
  /** For an object value, the fields it has, so the ones it leaves out stand apart. */
  presentKeys?: string[];
  /** What validation found wrong with the field, shown above what the lexicon says. */
  issues?: string[];
  renderTrigger: HoverTriggerRenderer;
}) => {
  // Wrapped, so a field the lexicon can't describe still counts as loaded.
  const preview = createHoverResource(
    () => `${props.collection}/${props.steps.map((step) => step.key).join("/")}`,
    async () => ({ field: await fieldSchemaAt(props.collection, props.steps, props.valueType) }),
  );

  return (
    <HoverCard
      onHover={preview.load}
      hoverDelay={400}
      trigger={props.renderTrigger({ loading: preview.visibleLoading })}
      class="inline-flex"
      // The page's size, as on the Schema tab, so the field's name stays larger than its type.
      previewClass="w-max max-w-sm font-sans text-base"
      // Nothing in it to click, so the mouse goes through to the JSON it covers.
      passThroughWhenCovering
      // A field with issues has a card even when its lexicon can't be described, once that's known.
      showPreview={
        !!preview.state().data?.field ||
        (!!props.issues?.length && !!(preview.state().data || preview.state().error))
      }
    >
      <div class="flex flex-col gap-2">
        <Show when={props.issues?.length}>
          <ul
            class="flex flex-col gap-0.5 text-sm text-red-600 dark:text-red-400"
            classList={{
              "border-b border-neutral-200 pb-2 dark:border-neutral-700":
                !!preview.state().data?.field,
            }}
          >
            <For each={props.issues}>
              {(issue) => (
                <li class="flex items-baseline gap-1.5">
                  <span class="iconify lucide--circle-alert shrink-0 translate-y-0.5" />
                  {issue}
                </li>
              )}
            </For>
          </ul>
        </Show>
        <Show when={preview.state().data?.field}>
          {(field) => (
            <FieldSchemaView
              name={props.name}
              field={field()}
              valueType={props.valueType}
              presentKeys={props.presentKeys}
            />
          )}
        </Show>
      </div>
    </HoverCard>
  );
};

const FieldSchemaView = (props: {
  name: string;
  field: FieldSchema;
  valueType?: string;
  presentKeys?: string[];
}) => {
  const nsid = () => props.field.definedIn.split("#")[0];
  // Local `#refs` in full, the field's own and its items', since the card isn't on the
  // lexicon's own page.
  const fullRef = (ref?: string) => ref && absoluteRef(ref, nsid());
  const fullRefs = (refs?: string[]) => refs?.map((ref) => absoluteRef(ref, nsid()));
  const property = () => {
    const field = props.field.property;
    if (!field) return;
    return {
      ...field,
      // A ref's own description if it has one, otherwise the one of what it points to.
      description: field.description ?? props.field.refDescription,
      ref: fullRef(field.ref),
      refs: fullRefs(field.refs),
      items: field.items && {
        ...field.items,
        ref: fullRef(field.items.ref),
        refs: fullRefs(field.items.refs),
      },
    };
  };
  const currentType = () => (props.valueType ? absoluteRef(props.valueType, nsid()) : undefined);

  return (
    <div class="flex flex-col gap-2">
      <Show
        when={property()}
        fallback={
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            <span class="font-semibold text-neutral-800 dark:text-neutral-200">{props.name}</span>{" "}
            isn't in the schema.
          </p>
        }
      >
        {(property) => (
          <LexiconPropertyView
            name={props.name}
            property={property()}
            required={props.field.required}
            currentType={currentType()}
          />
        )}
      </Show>
      {/* What the object can hold, beyond what this record shows: required ones are starred, and
          ones this record leaves out are dimmed. */}
      <Show when={props.field.properties?.length}>
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
          <span class="text-neutral-500 dark:text-neutral-400">properties:</span>
          <For each={props.field.properties}>
            {(property) => (
              <span
                class="font-mono"
                classList={{
                  "text-neutral-700 dark:text-neutral-300":
                    props.presentKeys?.includes(property.name) ?? true,
                  "text-neutral-400 dark:text-neutral-500": !(
                    props.presentKeys?.includes(property.name) ?? true
                  ),
                }}
              >
                {property.name}
                <Show when={property.required}>
                  <span class="text-amber-600 dark:text-amber-500">*</span>
                </Show>
              </span>
            )}
          </For>
        </div>
      </Show>
      {/* Set apart, so it doesn't read as one more entry of a union's list. */}
      <span class="border-t border-neutral-200 pt-2 font-mono text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        {props.field.definedIn}
      </span>
    </div>
  );
};

export default FieldHoverCard;
