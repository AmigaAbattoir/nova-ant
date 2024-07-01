**Ant** provides sidebar integration to use **[Apache Ant](https://ant.apache.org/)** to allow you to launch build tasks.

Included in the extensions is Apache Ant 1.10.14.

![](images/ant-screenshot.png)

Icons taken from Eclipse Ant.

## Requirements

Ant requires some additional tools to be installed on your Mac:

- Java 8 or newer

Make sure that `JAVA_HOME` has been set, and points to a JDK in you system. Otherwise, you may get errors if the build is using `javac`.

## Usage

To display the Ant sidebar:

- Click on the "All Sidebars" button.
- Select **Ant** or drag to a sidebar area

In the Ant sidebar, you can right-click and select "Run" on a target.

On targets and on other elements in the sidebar, you can also select "Show in Build XML" to jump to that point in the XML

### Configuration

In the future, to configure global preferences, open **Extensions → Extension Library...** then select Ant's **Preferences** tab.

In the future, you can also configure preferences on a per-project basis in **Project → Project Settings...**

### Additional notes

Currently, it only works if there is a `build.xml` at the root of your project. In the future, that will change.