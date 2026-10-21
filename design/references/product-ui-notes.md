# Selected product UI guidance

Original project notes informed by the local Impeccable references listed in [provenance](README.md). These notes apply the user's Webflow direction and do not import another framework or workflow.

## Product UI

Use the same control vocabulary throughout the workspace. Compact tables, small labels and familiar panel navigation are intentional here. Keep a readable sans family, modest heading scale and alignment that helps users scan. Reserve accent color for actions, selection and feedback.

## Interaction

Design keyboard focus independently of hover. Keep labels visible after a value is entered, associate hints/errors with inputs, and explain validation next to the relevant field. An overlay must escape its scroll container, remain within the viewport and return focus when dismissed. Prefer the selected control library's supported behavior over a parallel custom overlay system.

## Color

Name semantic roles before applying color values. Distinguish surface, hover, selection, text, focus and validation tokens; map both custom UI and PrimeNG to them. Dark surfaces need their own hierarchy. Measure contrast for text and important control boundaries; status text/icon supplements hue.

## Motion

Feedback follows the action immediately and remains short. Use motion to clarify opening, closing, switching and saving. Avoid load choreography in a workspace. Opacity and transform are preferred for overlay motion; direct manipulation tracks the pointer without tweening. Respect reduced motion while preserving readable feedback.

## Review

Try the actual workflow before polishing isolated pixels: select a row, open the editor, enter long Vietnamese content, trigger validation, save through the API and return to the list. Then verify the same workflow in the other theme and with the keyboard. Any untested behavior stays explicitly pending.
