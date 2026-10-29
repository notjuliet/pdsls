import { Show } from "solid-js";

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
  renderTrigger: HoverTriggerRenderer;
}) => {
  // Wrapped, so a field the lexicon can't describe still counts as loaded.
  const preview = createHoverResource(
    () => `${props.collection}/${props.steps.map((step) => step.key).join("/")}`,
    async () => ({ field: await fieldSchemaAt(props.collection, props.steps) }),
  );

  return (
    <HoverCard
      onHover={preview.load}
      hoverDelay={400}
      trigger={props.renderTrigger({ loading: preview.visibleLoading })}
      class="inline-flex"
      // The page's size, as on the Schema tab, so the field's name stays larger than its type.
      previewClass="w-max max-w-sm font-sans text-base"
      showPreview={!!preview.state().data?.field}
    >
      <Show when={preview.state().data?.field}>
        {(field) => (
          <FieldSchemaView name={props.name} field={field()} valueType={props.valueType} />
        )}
      </Show>
    </HoverCard>
  );
};

const FieldSchemaView = (props: { name: string; field: FieldSchema; valueType?: string }) => {
  const nsid = () => props.field.definedIn.split("#")[0];
  // A union's local `#refs` in full, its own or its items', since the card isn't on the
  // lexicon's own page.
  const fullRefs = (refs?: string[]) => refs?.map((ref) => absoluteRef(ref, nsid()));
  const property = () => {
    const field = props.field.property;
    if (!field) return;
    return {
      ...field,
      refs: fullRefs(field.refs),
      items: field.items && { ...field.items, refs: fullRefs(field.items.refs) },
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
      {/* Set apart, so it doesn't read as one more entry of a union's list. */}
      <span class="border-t border-neutral-200 pt-2 font-mono text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        {props.field.definedIn}
      </span>
    </div>
  );
};

export default FieldHoverCard;
