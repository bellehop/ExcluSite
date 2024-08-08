# Contribution Guide

## Guidelines

1. **No Changes to Aesthetics:**
   - Please do not make any changes to the visual design, layout, or styling of the extension. This includes modifications to CSS, HTML structure, and design assets.

2. **Focus on Functionality:**
   - Contributions should focus on improving functionality, fixing bugs, and optimizing performance. Examples include improving UI transitions, fixing initialization issues, and enhancing filtering performance.

3. **Follow Coding Standards:**
   - Ensure that your code follows the project's coding standards and best practices. This helps maintain code quality and readability.

4. **Testing:**
   - Test your changes thoroughly before submitting a pull request. Include test cases and documentation as needed.

## How to Contribute

1. **Fork the Repository:**
   - Click the "Fork" button at the top right of the repository page to create a copy of the repository in your GitHub account.

2. **Create a New Branch:**
   - Clone the forked repository to your local machine:
     ```bash
     git clone https://github.com/bellehop/ExcluSite.git
     ```
   - Navigate to the project directory:
     ```bash
     cd ExcluSite
     ```
   - Create a new branch for your changes:
     ```bash
     git checkout -b your-branch-name
     ```

3. **Make Your Changes:**
   - Follow the coding standards and guidelines provided in this document.
   - Ensure that your changes do not modify the aesthetics of the extension.

4. **Test Your Changes:**
   - Test your changes thoroughly to ensure they work as expected.

5. **Submit a Pull Request:**
   - Push your changes to your forked repository:
     ```bash
     git push origin your-branch-name
     ```
   - Open a pull request on the original repository with a detailed description of your changes.

## Coding Standards

- Follow the existing code style and conventions.
- Write clear and concise commit messages.
- Include comments and documentation where necessary.

## Testing

- Ensure that your changes are thoroughly tested.
- Include test cases and documentation as needed.

## Code of Conduct

We expect all contributors to adhere to our Code of Conduct. Please read it to understand the standards for behavior in our community.

## Additional Context for ExcluSite

### Smooth Expansion and Collapse of the Logger Element
- **Description:** The logger element within the popup does not expand and collapse smoothly. Sometimes, when it is collapsed, it stays the same width and only collapses lengthwise.
- **Files Involved:** `popup.js`, `popup.html`

### Initial Installation Filtering Issue
- **Description:** On initial installation, the filtering of search results option is on by default, but for filtering to actually work, you have to turn it off and then on again.
- **Files Involved:** `options.js`, `options.html`

### UI Improvements
- **Description:** The UI needs to be improved and fixed, particularly in the popup. This includes ensuring consistent width and height transitions and making the interface more user-friendly.
- **Files Involved:** `popup.js`, `popup.html`

### Performance Optimization
- **Description:** The extension needs to be optimized to improve performance and filter search results faster, similar to how uBlock Origin blocks ads quickly.
- **Files Involved:** `popup.js`, `content.js`, `background.js`

Thank you for your contributions!
