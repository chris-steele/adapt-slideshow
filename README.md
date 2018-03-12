The slideshow extension takes an arbitrary collection of views (e.g. articles, blocks, components) and displays them as a sequence of slides.

Transitions between slides are supported with an optional `fade` or `slide` effect.

slideshows can be attached directly to a given container or rendered in a notify-style popup.

### Tabbing

To meet accessibility requirements the slideshow will need to allow tabbing between the relevant elements within each slide. For slideshows that display in a popup there will need to be an explicit option that determines whether the popup should act modally or not. When a modal popup is open tabbing will be confined to the active slide and the slideshow controls. All other slideshows will allow tabbing to enter and leave the slideshow so that the user can access the rest of the document. Note that users must use the slideshow controls to navigate between slides: control of the tab order will therefore be required to prevent tabbing to out-of-view slides.

### Focus

Whether accessibility is required or not we must deal with the focus issue. The primary concern is that when an element becomes active (i.e. document.activeElement) the browser attempts to make it visible. If an element in an out-of-view slide is focussed it becomes active and the slideshow viewport is scrolled to bring it into view. This behaviour can be observed with some components: during render question components will try to give themselves focus when part of a slideshow. This can also be a problem if a question component is present in the active slide because the browser will potentially scroll vertically to bring the active element into view.

There are various ways to prevent this undesirable behaviour. A simple way is to use visibility:hidden for out-of-view slides. The problem with this approach is that it is in conflict with the ability to transition/swipe between slides. Another way would be to override the focus function, but this is not best practise and risky: for example it isn't known whether this would interfere with screen reader operation. Ideally, there would be an event trap that would allow us to shift focus to an appropriate element. Unfortunately this is only possible while the document has focus. When the user shifts focus away from the document (e.g. to the browser chrome) calls to focus() still succeed in changing the active element, but don't emit focus events. The browser makes the element active and attempts to make it visible. Polling document.activeElement is a solution, but is considered too inefficient to be suitable.

In conclusion the most practical way to address undesired scrolling is to take remedial action rather than try to control the cause. Whether the document has focus or not, scroll events are still emitted prior to repaints. Therefore we can listen for these events on the slideshow viewport and correct the effect.

To meet the immediate needs of the Oil Spills project the above will be implemented in two phases. Phase 1 will address the focus issues and Phase 2 will address tabbing. Phase 1 alone will satisfy Oil Spills because accessibility is not a requirement.

### Phase 1
 1.1 modify QuestionView::setQuestionAsReset to only call a11y_focus() if page AND component are ready
 1.2 add scroll listener to prevent errant scrolling when elements become active

### Phase 2
 2.1 modal switch for popups
 2.2 control of tab order: out-of-view slides are not tabbable (use a11y_on)
 2.3 modify narrative postRender to ensure setReadyStatus is called after a11y_focus
 2.4 override setReadyStatus method on view instances to overcome problem of _isReady being a model property

### Notes

-1.1 reveals the assumption question components make: they will only ever be part of a page and at most one page exists at a time.
-1.2 is important defensive programming because some code we have no control over (e.g. third party widgets/polyfills/libraries).
-Because _isReady is a model property we must avoid rendering the same model more than once at a time.


## Render sequence

## 1 ##
The slideshow element is attached to the DOM. This allows slides to properly calculate dimensions etc.
## 2 ##
The appropriate template is rendered inside the slideshow element.
## 3 ##
The slides are appended inside the slideshow. The slides inherit the width allowed by the popup/container.
## 4 ##
Once all slides have triggered their `ready` event dimensions are set on the slide container and widths are set on the slide items. The transition classes become active. Note that the transition classes are not applied initially so that slide width can be inherited from the popup.
## 5 ##
A resize is triggered, firing a sequence of device resize events (preResize, resize and postResize).

`device` resize events:

## 1 ##
`device:preResize` fires and the slideshow handles this event. If used, the popup is instructed to remove its scrollbar if present. The slideshow then updates the widths of the slide items and slide container. The height is unset on the slide container so that slide items are not vertically constrained.
## 2 ##
Slide handlers execute and adjust themselves to the available area.
## 3 ##
`device:postResize` is triggered.
## 4 ##
Any listeners of the window `resize` event are triggered. This is to accommodate components such as `media` (MediaElement.js listens directly to window `resize` events not `device:resize`).
## 5 ##
The popup, if used, determines if a scrollbar is required.
## 6 ##
If a scrollbar has been added the slide items and slide container widths are updated. A `device:resize` event is triggered to allow slides to accommodate the scrollbar.
## 7 ##
The `resize` event is again triggered on the window.
## 8 ##
Margins are set to allow the popup to be centred vertically and horizontally within its container.

Some components (e.g. `accordion`) may grow in height with user input. The slideshow listens to `jquery.resize` events on slide items and will adjust accordingly.

On `jquery.resize` events:

## 1 ##

A scrollbar may have been added or removed, so the width available to slides and/or the height of the slideshow may have changed, so execute a general resize sequence.

### IMPORTANT

This extension requires the following changes:

- `device.js` to trigger `device:preResize` and `device:postResize` events. This is a preferred method to using deferred calls.
- `adaptView.js` must track child views via a `_childViews` array on a `state` object (instance of `Backbone.Model`).
- `questionView.js` requires `setQuestionAsReset` to check component is ready before calling `a11y_focus`.
- the `setupNarrative` call in the narrative component must occur before the `setReadyStatus` call (DOM manipulations must be done prior to `setReadyStatus` otherwise height calculations can be incorrect)