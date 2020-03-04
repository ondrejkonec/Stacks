namespace Stacks {

    export class ModalController extends Stacks.StacksController {
        static targets = ["modal"];

        private modalTarget!: HTMLElement;

        private _boundClickFn!: any;
        private _boundKeypressFn!: any;

        private returnElement!: HTMLElement;

        private _boundTabTrap!: any;

        connect () {
            this.validate();
        }

        /**
         * Disconnects all added event listeners on controller disconnect
         */
        disconnect() {
            this.unbindDocumentEvents();
        };

        /**
         * Toggles the visibility of the modal
         */
        toggle () {
            this._toggle();
        }

        /**
         * Shows the modal
         */
        show () {
            this._toggle(true);
        }

        /**
         * Hides the modal
         */
        hide () {
            this._toggle(false);
        }

        /**
         * Validates the modal settings and attempts to set necessary internal variables
         */
        private validate() {
            // check for returnElement support
            var returnElementSelector = this.data.get("return-element");
            if (returnElementSelector) {
                this.returnElement = <HTMLElement>document.querySelector(returnElementSelector);

                if (!this.returnElement) {
                    throw "Unable to find element by return-element selector: " + returnElementSelector;
                }
            }
        }

        /**
         * Toggles the visibility of the modal element
         * @param show Optional parameter that force shows/hides the element or toggles it if left undefined
         */
        private _toggle (show?: boolean | undefined) {
            var toShow = show;
            var isVisible = this.modalTarget.getAttribute("aria-hidden") === "false";

            // if we're letting the class toggle, we need to figure out if the popover is visible manually
            if (typeof toShow === "undefined") {
                toShow = !isVisible;
            }

            // if the state matches the disired state, return without changing anything
            if ((toShow && isVisible) || (!toShow && !isVisible)) {
                return;
            }

            // show/hide events trigger before toggling the class
            var triggeredEvent = this.triggerEvent(toShow ? "show" : "hide");

            // if this pre-show/hide event was prevented, don't attempt to continue changing the modal state
            if (triggeredEvent.defaultPrevented) {
                return;
            }

            this.modalTarget.setAttribute("aria-hidden", toShow ? "false" : "true");

            if (toShow) {
                this.bindDocumentEvents();
            }
            else {
                this.unbindDocumentEvents();
                this.focusReturnElement();
            }

            // check for transitionend support
            var supportsTransitionEnd = (<HTMLElement>this.modalTarget).ontransitionend !== undefined;

            // shown/hidden events trigger after toggling the class
            if (supportsTransitionEnd) {
                // wait until after the modal finishes transitioning to fire the event
                this.modalTarget.addEventListener("transitionend", () => {
                    //TODO this is firing waaay to soon?
                    this.triggerEvent(toShow ? "shown" : "hidden");
                }, { once: true });
            } else {
                this.triggerEvent(toShow ? "shown" : "hidden");
            }           
        }

        /**
         * Listens for the s-modal:hidden event and focuses the returnElement when it is fired
         */
        private focusReturnElement() {
            if (!this.returnElement) {
                return;
            }

            this.modalTarget.addEventListener("s-modal:hidden", () => {
                // double check the element still exists when the event is called
                if (this.returnElement && document.body.contains(this.returnElement)) {
                    this.returnElement.focus();
                }
            }, {once: true });
        }

        /**
         * Binds tab presses on tabbable items such that tabbing only works within the modal
         */
        private bindTabFocusTrap() {
            // get all tabbable items
            var allTabbables = Array.from(this.modalTarget.querySelectorAll("[href], input, select, textarea, button, [tabindex]"))
                .filter((el: Element) => el.matches(":not([disabled]):not([tabindex='-1'])"));


            if (!allTabbables.length) {
                return;
            }

            var firstTabbable = <HTMLElement>allTabbables[0];
            var lastTabbable = <HTMLElement>allTabbables[allTabbables.length - 1];

            // if the first or last item is tabbed over, ensure that the focus "loops" back to the end of the array instead of leaving the modal
            this._boundTabTrap = this._boundTabTrap || ((e: KeyboardEvent) => {
                // if somehow the user has tabbed out of the modal or if focus started outside the modal, push them to the first item
                if (!this.modalTarget.contains(<Element>e.target)) {
                    e.preventDefault();
                    firstTabbable.focus();
                }

                // if they've tabbed backwards over the first item, then go to the last item
                if (e.target == firstTabbable && e.keyCode === 9 && e.shiftKey) {
                    e.preventDefault();
                    lastTabbable.focus();
                }

                // if they've tabbed forwards over the last item, then go to the first item
                if (e.target == lastTabbable && e.keyCode === 9 && !e.shiftKey) {
                    e.preventDefault();
                    firstTabbable.focus();
                }
            });

            document.addEventListener("keydown", this._boundTabTrap);
        }

        /**
         * Binds global events to the document for hiding popovers on user interaction
         */
        private bindDocumentEvents () {
            // in order for removeEventListener to remove the right event, this bound function needs a constant reference
            this._boundClickFn = this._boundClickFn || this.hideOnOutsideClick.bind(this);
            this._boundKeypressFn = this._boundKeypressFn || this.hideOnEscapePress.bind(this);

            document.addEventListener("click", this._boundClickFn);
            document.addEventListener("keyup", this._boundKeypressFn);

            this.bindTabFocusTrap();
        }

        /**
         * Unbinds global events to the document for hiding popovers on user interaction
         */
        private unbindDocumentEvents () {
            document.removeEventListener("click", this._boundClickFn);
            document.removeEventListener("keyup", this._boundKeypressFn);
            document.removeEventListener("keydown", this._boundTabTrap);
        }

        /**
         * Forces the popover to hide if a user clicks outside of it or its reference element
         */
        private hideOnOutsideClick (e: Event) {
            var target = <Node>e.target;
            // check if the document was clicked inside either the toggle element or the modal itself
            // note: .contains also returns true if the node itself matches the target element
            if (!this.modalTarget.querySelector(".s-modal--dialog")!.contains(target)) {
                this._toggle(false);
            }
        }

        /**
         * Forces the popover to hide if the user presses escape while it, one of its childen, or the reference element are focused
         */
        private hideOnEscapePress (e: KeyboardEvent) {
            // if the ESC key (27) wasn't pressed or if no popovers are showing, return
            if (e.which !== 27 || this.modalTarget.getAttribute("aria-hidden") === "true") {
                return;
            }

            this._toggle(false);
        }
    }

    /**
     * Helper to manually show an s-modal element via external JS
     * @param element the element the `data-controller="s-modal"` attribute is on
     */
    export function showModal(element: HTMLElement) {
        toggleModal(element, true);
    }
   
    /**
     * Helper to manually hide an s-modal element via external JS
     * @param element the element the `data-controller="s-modal"` attribute is on
     */
    export function hideModal(element: HTMLElement) {
        toggleModal(element, false);
    }

    /**
     * Helper to manually show an s-modal element via external JS
     * @param element the element the `data-controller="s-modal"` attribute is on
     * @param show whether to force show/hide the modal; toggles the modal if left undefined
     */
    function toggleModal(element: HTMLElement, show?: boolean | undefined) {
        var controller = Stacks.application.getControllerForElementAndIdentifier(element, "s-modal") as ModalController;

        if (!controller) {
            throw "Unable to get s-modal controller from element";
        }

        show ? controller.show() : controller.hide();
    }
}
Stacks.application.register("s-modal", Stacks.ModalController);
